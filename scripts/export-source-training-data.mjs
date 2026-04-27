import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);

const resolveArgValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
};

const reviewedOnly = args.includes('--reviewed-only');
const explicitDbPath = resolveArgValue('--db');
const explicitOutputPath = resolveArgValue('--output');

const candidateDbPaths = [
  explicitDbPath,
  path.join(process.cwd(), 'server', 'data', 'platform-db.json'),
  path.join(process.cwd(), 'data', 'platform-db.json'),
].filter(Boolean);

const resolveExistingPath = async (candidates) => {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('Could not find platform-db.json. Use --db to provide the path.');
};

const csvEscape = (value) => {
  if (value == null) {
    return '';
  }
  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }
  return `"${stringValue.replaceAll('"', '""')}"`;
};

const toCsv = (rows, headers) => [
  headers.map(csvEscape).join(','),
  ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
].join('\n');

const main = async () => {
  const dbPath = await resolveExistingPath(candidateDbPaths);
  const rootDir = dbPath.includes(`${path.sep}server${path.sep}data${path.sep}`)
    ? dbPath.slice(0, dbPath.indexOf(`${path.sep}server${path.sep}data${path.sep}`))
    : process.cwd();
  const outputPath = explicitOutputPath || path.join(rootDir, 'exports', 'source-training-data.csv');

  const raw = await fs.readFile(dbPath, 'utf8');
  const data = JSON.parse(raw);

  const submissionsById = new Map((data.submissions || []).map((submission) => [submission.id, submission]));
  const sourceReviewsByReportId = new Map();
  for (const review of data.sourceReviews || []) {
    if (!sourceReviewsByReportId.has(review.reportId)) {
      sourceReviewsByReportId.set(review.reportId, []);
    }
    sourceReviewsByReportId.get(review.reportId).push(review);
  }

  for (const reviews of sourceReviewsByReportId.values()) {
    reviews.sort((left, right) => new Date(right.reviewedAt || 0) - new Date(left.reviewedAt || 0));
  }

  const rows = (data.reports || []).map((report) => {
    const submission = submissionsById.get(report.submissionId) || null;
    const sourceAnalysis = report.sourceAnalysis || submission?.sourceAnalysis || null;
    const sourceReview = report.sourceReview || sourceReviewsByReportId.get(report.id)?.[0] || null;
    const signals = sourceAnalysis?.signals || {};

    return {
      report_id: report.id,
      report_reference: report.reference || '',
      submission_id: report.submissionId || '',
      created_at: report.createdAt || '',
      analyst_status: report.analystStatus || '',
      title: report.title || '',
      artist: report.artist || '',
      venue_id: report.venueId || '',
      predicted_source_class: sourceAnalysis?.sourceClass || '',
      predicted_confidence: sourceAnalysis?.confidence ?? '',
      predicted_score: sourceAnalysis?.score ?? '',
      predicted_model_version: sourceAnalysis?.modelVersion || '',
      reviewed_source_class: sourceReview?.reviewedClass || '',
      reviewed_is_override: sourceReview?.isOverride ?? '',
      reviewed_at: sourceReview?.reviewedAt || '',
      reviewed_by: sourceReview?.reviewerId || '',
      reviewed_notes: sourceReview?.notes || '',
      eligible_for_training: sourceReview?.reviewedClass ? 'yes' : 'no',
      ...signals,
    };
  }).filter((row) => row.predicted_source_class);

  const filteredRows = reviewedOnly
    ? rows.filter((row) => row.reviewed_source_class)
    : rows;

  const signalHeaders = Array.from(new Set(filteredRows.flatMap((row) => (
    Object.keys(row).filter((key) => ![
      'report_id',
      'report_reference',
      'submission_id',
      'created_at',
      'analyst_status',
      'title',
      'artist',
      'venue_id',
      'predicted_source_class',
      'predicted_confidence',
      'predicted_score',
      'predicted_model_version',
      'reviewed_source_class',
      'reviewed_is_override',
      'reviewed_at',
      'reviewed_by',
      'reviewed_notes',
      'eligible_for_training',
    ].includes(key))
  )))).sort();

  const headers = [
    'report_id',
    'report_reference',
    'submission_id',
    'created_at',
    'analyst_status',
    'title',
    'artist',
    'venue_id',
    'predicted_source_class',
    'predicted_confidence',
    'predicted_score',
    'predicted_model_version',
    'reviewed_source_class',
    'reviewed_is_override',
    'reviewed_at',
    'reviewed_by',
    'reviewed_notes',
    'eligible_for_training',
    ...signalHeaders,
  ];

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${toCsv(filteredRows, headers)}\n`, 'utf8');

  console.log(`Exported ${filteredRows.length} source-analysis row(s) to ${outputPath}`);
  if (!reviewedOnly) {
    console.log(`Reviewed rows available for training: ${filteredRows.filter((row) => row.reviewed_source_class).length}`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

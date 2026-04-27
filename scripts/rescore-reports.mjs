import path from 'path';
import { fileURLToPath } from 'url';

const usage = `Usage:
  node scripts/rescore-reports.mjs --report REP-484E3F
  node scripts/rescore-reports.mjs --submission SC-2A450C

Options:
  --report <id-or-reference>       Rescore the submission tied to a report.
  --submission <id-or-reference>   Rescore a submission directly.
  --skip-visual-refresh            Reuse stored visual analysis and only rescore the application layer.
  --fallback-only                  Skip Gemini and use deterministic fallback logic only.
  --help                           Show this message.
`;

const reportIdentifiers = [];
const submissionIdentifiers = [];
let refreshVisualAnalysis = true;
let useGemini = true;

for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];

    if (arg === '--report') {
        const value = process.argv[index + 1];
        if (!value) {
            throw new Error('Missing value for --report');
        }
        reportIdentifiers.push(value);
        index += 1;
        continue;
    }

    if (arg === '--submission') {
        const value = process.argv[index + 1];
        if (!value) {
            throw new Error('Missing value for --submission');
        }
        submissionIdentifiers.push(value);
        index += 1;
        continue;
    }

    if (arg === '--skip-visual-refresh') {
        refreshVisualAnalysis = false;
        continue;
    }

    if (arg === '--fallback-only') {
        useGemini = false;
        continue;
    }

    if (arg === '--help') {
        console.log(usage);
        process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
}

if (!reportIdentifiers.length && !submissionIdentifiers.length) {
    console.log(usage);
    throw new Error('Provide at least one --report or --submission identifier.');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptDir, '..', 'server');
process.chdir(serverDir);

const { rescoreStoredEvidence } = await import('../server/index.js');

const summary = await rescoreStoredEvidence({
    reportIdentifiers,
    submissionIdentifiers,
    refreshVisualAnalysis,
    useGemini,
});

console.log(JSON.stringify(summary, null, 2));

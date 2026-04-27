import fs from 'fs/promises';

import { analyzeAudioSource } from '../server/sourceAnalysis.js';
import { getAssetAbsolutePath, mutatePlatformData } from '../server/platformStore.js';

const recomputed = [];
const skipped = [];

await mutatePlatformData(async (data) => {
  for (const submission of data.submissions) {
    if (!submission.derivedAudioAssetId) {
      skipped.push({ reference: submission.reference, reason: 'no-derived-audio' });
      continue;
    }

    const assetPath = await getAssetAbsolutePath(submission.derivedAudioAssetId);
    if (!assetPath) {
      skipped.push({ reference: submission.reference, reason: 'missing-derived-audio-file' });
      continue;
    }

    try {
      const wavBuffer = await fs.readFile(assetPath);
      const sourceAnalysis = analyzeAudioSource(wavBuffer);
      submission.sourceAnalysis = sourceAnalysis;

      for (const report of data.reports.filter((item) => item.submissionId === submission.id)) {
        report.sourceAnalysis = sourceAnalysis;
      }

      recomputed.push({
        reference: submission.reference,
        sourceClass: sourceAnalysis.sourceClass,
        score: sourceAnalysis.score,
      });
    } catch (error) {
      skipped.push({ reference: submission.reference, reason: error.message });
    }
  }
});

console.log(JSON.stringify({
  recomputedCount: recomputed.length,
  skippedCount: skipped.length,
  recomputed,
  skipped,
}, null, 2));

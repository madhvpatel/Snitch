# PA Source Classification Design

This note explains:

- what Snitch does today
- why that is not enough to prove `PA speaker` vs `personal device`
- how to build a better classification layer into the active backend

## Current state

There are two separate source-detection ideas in the repo.

### 1. Active backend path

In the active processing flow in [server/index.js](/Users/madhavpatel/Snitch_1/server/index.js):

- raw video is uploaded
- audio is extracted with FFmpeg
- ACRCloud is used for track identification
- Gemini generates a short forensic summary
- a deterministic source classifier now runs on the derived WAV audio

The deterministic classifier is implemented in [server/sourceAnalysis.js](/Users/madhavpatel/Snitch_1/server/sourceAnalysis.js). It is stored on:

- each processed submission as `sourceAnalysis`
- each generated report as `sourceAnalysis`

The backend still also asks Gemini whether the audio sounds like:

- room playback
- direct feed
- uncertain mix

So the current backend now has both:

- a deterministic `sourceClass` / `confidence` / `score`
- a qualitative forensic summary

This is useful as analyst support, but it is still **not** a final proof gate by itself.

### 2. Legacy frontend heuristic

There is an older experimental heuristic in [src/services/audioUtils.js](/Users/madhavpatel/Snitch_1/src/services/audioUtils.js).

That heuristic:

- isolates a loud 3-second window
- estimates low-frequency energy vs mid-band energy
- computes `subRMS / midsRMS`
- labels the source roughly as:
  - `Large PA System`
  - `Possible PA / Car`
  - `Small Speaker`
  - `Phone / Laptop`

This is directionally useful, but it is too weak to rely on for enforcement.

## Why the old heuristic is not enough

Low-end energy alone is not a stable proof signal.

It can be distorted by:

- venue acoustics
- microphone placement
- phone microphone roll-off
- aggressive EQ
- bass-heavy Bluetooth speakers
- standing near a subwoofer
- crowd noise masking mids

So the system should never make a final binary claim from only one spectral ratio.

## Recommended model

Treat source verification as a **multi-signal score**, not a single rule.

The backend should output:

- `sourceClass`
  - `likely_pa_system`
  - `likely_small_speaker`
  - `likely_personal_device`
  - `inconclusive`
- `confidence`
  - `0.0` to `1.0`
- `signals`
  - individual measured features
- `explanation`
  - short human-readable summary

Important rule:

- the classifier should support analyst review
- it should **not** be the only gate for report creation

## Phase 1 status

Phase 1 is now live.

Current output classes:

- `likely_pa_system`
- `likely_small_speaker`
- `likely_personal_device`
- `inconclusive`

Current visible surfaces:

- portal report detail in [src/pages/PortalPage.jsx](/Users/madhavpatel/Snitch_1/src/pages/PortalPage.jsx)
- mobile submission detail in [SnitchV1/frontend/app/submission-detail.tsx](/Users/madhavpatel/Snitch_1/SnitchV1/frontend/app/submission-detail.tsx)

Pre-prod review path:

- analysts can now save a separate source ground-truth label in the portal without changing the final case verdict
- the latest analyst source label is stored on the report as `sourceReview`
- every saved source review is also appended to `data.sourceReviews` for auditability
- training CSV export is available with:
  - `npm run export:source-training`
  - `npm run export:source-training -- --reviewed-only`

Phase 1 currently uses deterministic signals only:

- sub-bass vs mid-band energy
- bass vs mid-band energy
- high-frequency roll-off
- ambient continuity inside the loudest 3-second window
- silence ratio
- dynamic range
- crest factor

Phase 1 also now includes a conservative `nearFieldBloomSuspicion` guardrail.

Reason:

- a nearby phone or small Bluetooth speaker can create very strong bass at the microphone
- that can look deceptively “big” if you only score low-end energy
- so the classifier now downgrades overly steady, bass-heavy, near-field patterns out of `likely_pa_system`

Important limitation:

- this remains a prioritization / analyst-support score
- it should not be treated as a standalone legal conclusion

## Classifier modes

The repo now preserves the original classifier as a stable baseline and adds a separate experimental mode.

Available modes:

- `source-v1`
  - the original Goertzel-probe classifier
  - this remains the default stable path
- `source-v2-fft`
  - an experimental FFT / third-octave-band classifier for testing
  - it preserves the representative hot window for explainability, but scores from all-window distributions across the full clip
  - this does **not** replace `source-v1`

How mode selection works:

- each submission can carry `sourceClassifierMode`
- if no override is supplied, the backend falls back to `SOURCE_CLASSIFIER_MODE` or `source-v1`
- the resulting `modelVersion` is stored on the report and shown in the portal/mobile detail views

Testing guidance:

- use `source-v1` for baseline comparisons
- use `source-v2-fft` for side-by-side pre-prod testing
- do not mix the two silently when collecting training or audit data

What `source-v2-fft` adds in pre-prod:

- third-octave spectral coverage instead of sparse probe frequencies
- per-window FFT analysis across the full clip, not just the hottest 3-second region
- cross-window continuity scoring
- cross-window variance / coefficient-of-variation features
- temporal envelope slope, so clips that decay as the recorder walks away are penalized
- the representative peak window is still stored for explainability and UI timing

## Signal groups

Use multiple feature groups and combine them.

### 1. Spectral balance

Measure:

- sub-bass energy `20–60 Hz`
- bass energy `60–120 Hz`
- lower mids `200–800 Hz`
- upper mids `800–2500 Hz`
- high-frequency roll-off `6–12 kHz`

Useful intuition:

- large PA playback often preserves stronger low-end and broader bandwidth
- phone/laptop playback often shows weak sub-bass and sharper high-end limitations

### 2. Room-playback evidence

Measure:

- reverberation tail / decay characteristics
- comb filtering / reflections
- crowd and ambient bed under music
- non-stationary room noise

Useful intuition:

- a venue PA usually sounds like room playback
- a phone held near the mic may sound more direct and dry

### 3. Dynamic behavior

Measure:

- compression signature
- clipping pattern
- crest factor
- short-term loudness stability

Useful intuition:

- venue playback chains often apply limiting / compression
- tiny speakers distort differently from installed systems

### 4. Distance / perspective cues

Measure:

- speech/ambient-to-music ratio
- transients blurred by distance
- stereo collapse / mono feel
- on-axis vs off-axis high-frequency loss

Useful intuition:

- music captured as part of an environment usually supports room playback
- direct playback from a nearby phone can sound unusually close and narrow

### 5. Visual corroboration

Only when a frame is available.

Look for:

- visible speaker cabinets
- DJ booth
- stage
- lighting rig
- crowd facing a performance area

Useful intuition:

- visual evidence should support or weaken the audio conclusion
- it should not override audio completely

### 6. Contextual anti-gaming signals

Use:

- venue type
- selected venue confidence
- repeat reports from same venue
- prior analyst verdicts
- capture movement patterns

Useful intuition:

- repeated reports with similar acoustic fingerprints at the same venue are stronger
- a one-off “clean” clip with no venue context is weaker

## Proposed score

Use a weighted score out of `100`.

### Feature buckets

- playback environment score: `30`
- spectral playback score: `25`
- dynamics/distortion score: `15`
- perspective/distance score: `15`
- visual corroboration score: `10`
- historical/context score: `5`

### Suggested output bands

- `>= 75`
  - `likely_pa_system`
- `55–74`
  - `likely_small_speaker`
- `35–54`
  - `inconclusive`
- `< 35`
  - `likely_personal_device`

### Guardrails

Force `inconclusive` if:

- clip duration is too short for stable analysis
- music is not confidently audible
- extracted audio quality is poor
- ambient masking is too high
- features disagree strongly

## Backend data shape

Add a source-analysis object to submissions/reports:

```json
{
  "sourceAnalysis": {
    "sourceClass": "likely_pa_system",
    "confidence": 0.82,
    "score": 81,
    "signals": {
      "subToMidRatio": 0.21,
      "roomPlaybackScore": 0.84,
      "reverbScore": 0.68,
      "directnessScore": 0.22,
      "compressionScore": 0.61,
      "ambientCrowdScore": 0.57,
      "visualPlaybackScore": 0.40
    },
    "explanation": [
      "Low-end energy is consistent with larger playback systems.",
      "Ambient bed and reflections suggest room playback rather than close-mic phone playback.",
      "Result remains probabilistic, not definitive."
    ],
    "modelVersion": "source-v1"
  }
}
```

## Rollout plan

### Phase 1

Add a backend-side deterministic heuristic.

Implement in Node or Python:

- extract audio
- compute band energies
- compute basic reverberation and dynamic features
- produce a score + explanation

This replaces the old frontend-only `sub/mid` label with something centralized and logged.

Status:

- implemented

### Phase 2

Use Gemini only as a **secondary explanation layer**.

Do not let Gemini decide the classification directly.

Instead:

- feed measured features into Gemini
- ask it to summarize the evidence
- keep the numeric class from deterministic code

### Phase 3

Train a lightweight classifier if enough labeled data exists.

Inputs:

- spectral features
- room-playback features
- dynamic features
- simple visual tags

Labels:

- `pa_system`
- `small_speaker`
- `personal_device`
- `inconclusive`

This should happen only after collecting a labeled internal dataset.

## What should count as proof

Even after this model exists, the safest position is:

- `likely_pa_system` strengthens the case
- `likely_personal_device` weakens the case
- `inconclusive` should stay reviewable

This source classifier should be one part of the evidence chain, not the whole case.

## Recommended implementation target

Add this to the active backend path in [server/index.js](/Users/madhavpatel/Snitch_1/server/index.js), immediately after audio extraction and before report creation.

Store the output on:

- submission
- report
- case packet export

Show it in:

- portal report detail
- exported case packet

Do **not** make contributor payouts depend on this signal alone in v1.

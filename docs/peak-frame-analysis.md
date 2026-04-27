# Peak Frame Analysis

## What was added

The backend now extracts a few still frames from the submitted video at timestamps where the audio is relatively strong.

Those frames are then used for a **visual evidence pass** that tries to answer practical questions like:

- does the scene show installed PA hardware?
- does it look more like a nearby phone or small portable speaker?
- are there venue identity cues visible?
- is the camera pointed somewhere useless, dark, or blocked?

## Why this helps

Audio-only source scoring is useful, but it can still make mistakes.

Example:

- a phone placed close to the recorder can sound bass-heavy
- a small speaker in a room can look like room playback in audio-only analysis

Peak-frame analysis helps reduce that by checking what the video actually shows near the louder music windows.

## How it works

### 1. Pick strong audio windows

After FFmpeg extracts WAV audio from the raw video, the server:

- scans the clip for stronger music-energy windows
- picks a few non-overlapping timestamps
- keeps those timestamps as `peakWindows`

### 2. Extract still frames

FFmpeg then extracts one frame at each selected timestamp and stores them as assets.

These become part of the evidence package.

### 3. Run visual AI analysis

If Gemini is configured, the server sends:

- the peak-aligned frames
- timestamp context
- matched song / venue context if available
- deterministic audio source score

The model returns a structured result with:

- playback context
- confidence
- summary
- visible equipment
- venue identity signals
- obstruction flags
- short frame observations

### 4. Store it on the report

The result is now attached to:

- the submission
- the generated report
- the exported evidence package

It is also shown in:

- the portal report detail
- the authority dashboard detail

## What the model can classify

Current visual output uses these buckets:

- `likely_installed_pa`
- `likely_small_portable_speaker`
- `likely_personal_device`
- `inconclusive`

This is an analyst-support signal, not a final legal proof label.

## What is now visible in the evidence package

Each report can now include:

- `visualContext.playbackContext`
- `visualContext.confidence`
- `visualContext.summary`
- `visualContext.visibleEquipment`
- `visualContext.venueIdentitySignals`
- `visualContext.obstructionFlags`
- `visualContext.frameObservations`
- `visualContext.frames`

## Current limits

- Frames are still images, not full scene tracking.
- Selection is based on stronger audio windows, not perfect “music-only” segmentation.
- If Gemini is not configured, the frames are still extracted but the visual verdict falls back to a conservative placeholder.
- This does not yet reason across full motion, speaker cones, lip sync, or object persistence over time.

## Files involved

- [server/peakFrameAnalysis.js](/Users/madhavpatel/Snitch_1/server/peakFrameAnalysis.js)
- [server/index.js](/Users/madhavpatel/Snitch_1/server/index.js)
- [src/pages/PortalPage.jsx](/Users/madhavpatel/Snitch_1/src/pages/PortalPage.jsx)
- [src/pages/AuthorityPage.jsx](/Users/madhavpatel/Snitch_1/src/pages/AuthorityPage.jsx)

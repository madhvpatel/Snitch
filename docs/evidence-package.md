# Evidence Package

This note explains what the exported case packet contains today and what was recently improved.

## Goal

The case packet should not just be a dump of raw report rows.

It should give an analyst or outside reviewer one structured package that explains:

- what was captured
- when and where it was captured
- how the media was identified
- how the audio was deconstructed if that layer is available
- what the source-analysis said
- what the peak-aligned video frames suggested
- what venue and rights context was attached
- what the current case status is
- why the packet supports a legal conclusion

## Current export shape

Case-packet export now uses a versioned wrapper:

- `casePacketVersion`
- `exportedAt`
- `exportedBy`
- `reportCount`
- `reports`

Each exported report now includes `evidencePackage`.

## Evidence package sections

Each `evidencePackage` currently contains these core sections, with some demo-only sections present when the related enrichment path is enabled:

### 1. Capture integrity

- submission reference
- capture session ID
- origin surface
- consent version
- duration
- media SHA-256
- signature status
- clock skew status
- measured start/end offsets
- local and processing timestamps
- device model / OS / app version
- start and end geolocation
- raw video and derived audio asset references

### 2. Audio identification

- provider name
- matched song
- title
- artist
- label
- album
- release date
- ISRC
- UPC
- matched track ID
- matched track confidence

### 3. Radio context

- current Wi-Fi connection context if available
- Bluetooth evidence capability/status
- current build limitations
- start/end radio snapshots carried from the mobile recorder

This is enrichment only. It should not be described as a full nearby Wi-Fi or BLE scan.

### 4. Source assessment

- source class
- confidence
- deterministic score
- raw signal values
- explanation list

This is where the Phase 1 PA-vs-small-speaker logic now lives.

### 5. Audio deconstruction (when enabled)

- source/stem-separated artifacts when available
- references to isolated vocal / instrumental outputs
- summary of what the deconstruction contributed to reviewer understanding

This is an enrichment layer. It is especially useful when the demo needs to show why the audio evidence is reviewable beyond a simple song match.

### 6. Venue context

- selected venue from the recorder
- matched venue in the platform
- merchant record
- GSTIN if known
- venue history for 30/90 day windows

### 7. Visual context

- peak windows selected from stronger audio sections
- extracted frame assets
- AI-based playback context
- visible equipment
- venue identity cues
- obstruction flags
- short frame observations

### 8. Rights and case context

- rights owner org
- rights type
- rights org text
- license assessment
- legal posture / legal conclusion for the demo flow when that review layer is used
- analyst status
- estimated recoverable value
- reward eligibility
- case reference and case status

### 9. Review trail

- analyst verdicts
- review notes
- tags
- review timestamps

## Why this helps

Before this change, the export was mostly a raw report object plus venue history.

Now the packet is much closer to what an analyst actually needs:

- chain-of-custody style fields
- ACRCloud evidence
- optional audio deconstruction artifacts
- radio context with explicit platform limits
- deterministic source analysis
- peak-frame visual corroboration
- venue/merchant identity
- rights and case framing
- a clearer legal-handoff posture

## Important limits

This is still not a final forensic-standard evidence chain.

Still pending:

- signed mobile capture payloads with a real device keypair
- stronger trust binding between mobile accounts and installs
- server-side hash verification against streamed upload bytes
- richer reviewer/export metadata for legal handoff
- a more formal legal-finality template and violation basis
- richer motion-aware visual corroboration beyond still peak frames

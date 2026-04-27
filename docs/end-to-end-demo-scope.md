# End-to-End Demo Scope

This note defines what a **complete end-to-end demo** of Snitch should show today, and what is still missing.

It is intentionally split into:

- **demo-ready scope**
- **remaining work for a stronger demo**
- **remaining work beyond demo into productization**

## Goal of the demo

The end-to-end demo should prove one simple story:

1. a contributor captures evidence in the field
2. the backend processes and enriches that evidence
3. the system deconstructs the captured audio into reviewable evidence layers
4. rights-holder analysts can review, finalize, and export it
5. authorities can triage it geographically, assess evidence quality, and see the legal posture
6. admins can supervise system health and platform data

The demo should show a **legal-finality story**:

- the evidence package should support a clear conclusion that unauthorized public performance took place
- the report should show why the venue, work, source context, and rights posture support action
- the exported packet should feel ready for legal or regulatory handoff

The demo still does **not** need to prove production-grade scaling or payments.

## Recommended demo narrative

Use one controlled scenario:

- music is audibly playing at a venue
- the contributor records a `15–20 second` clip
- the app captures time, location, venue context, and radio context
- the backend identifies the song, runs source analysis, performs **SAM audio deconstruction** for source/stem inspection, extracts peak frames, and builds a report
- the portal confirms the report, shows the legal posture, and exports a case packet
- the authority console shows the same report inside coordinate and quality-based triage with a legal-finality view

This is the cleanest story because it touches every major surface.

## Demo-ready scope

### 1. Landing and surface separation

Show:

- `/`
- `/capture`
- `/portal`
- `/authority`
- `/admin`

What the viewer should understand:

- each user type has a dedicated surface
- recorder, analyst, authority, and admin views are not mixed together

### 2. Mobile contributor flow

Use `SnitchV1` for the mobile capture portion.

Show:

- user sign-up / sign-in
- install registration
- live recording
- start/end geolocation
- GPS accuracy capture
- Wi-Fi / BLE evidence if available in the native build
- nearby venue lookup
- manual venue override
- Google Maps / Foursquare toggle
- explicit venue selection before submission
- upload and processing status

Success condition:

- a real mobile submission reaches the root backend and finalizes

### 3. Backend processing

Show that one submission becomes a processed report with:

- raw video asset
- derived WAV audio
- ACRCloud identification
- deterministic audio source analysis
- SAM audio deconstruction / stem breakdown
- peak-window frame extraction
- Gemini forensic summary
- Gemini visual frame analysis
- venue match
- merchant / GSTIN linkage if present
- license status and rights posture
- evidence package generation

Success condition:

- the submission reaches `ready`
- at least one report exists
- the evidence package is populated
- the audio deconstruction output is visible and tied back to the report

### 4. Rights-holder portal demo

Show:

- sign-in with seeded demo account
- dashboard totals
- report queue
- report detail
- forensic summary
- source analysis
- visual context
- radio context
- audio deconstruction view
- rights and case context
- legal posture / legal conclusion
- analyst review action
- case-packet export

Success condition:

- an analyst can confirm one report, apply a legal posture, and export a case packet

### 5. Legal-finality demo

Show:

- why the report qualifies as unauthorized public performance
- identified work and rights-owner context
- venue identity and merchant linkage
- chain-of-custody fields
- source assessment and audio deconstruction
- visual corroboration
- license status / lapsed / unlicensed posture
- a final export that reads like a legal handoff packet

Success condition:

- the operator can defend the conclusion on-screen without needing to improvise missing links

### 6. Authority dashboard demo

Show:

- sign-in
- coordinate clusters
- quality band distribution
- filtered report feed
- evidence detail panel
- chain-of-custody fields
- source analysis
- audio deconstruction
- visual frame analysis
- radio context
- legal posture
- case-packet export

Success condition:

- the same report is visible as an authority-facing evidence object with a clear legal conclusion, not just an analyst object

### 7. Admin demo

Show:

- dependency health
- rewards overview
- abuse queue
- imports for catalog / merchant / license / tariff / rights / venue coverage

Success condition:

- admin can demonstrate the system is operational and the data model is manageable

### 8. Audio deconstruction demo

This should be included if Demucs or the current source-separation path is available and stable during the session.

Show:

- `/python/health`
- one isolation request
- separated stems accessible through the Node proxy
- the report linking back to those deconstructed audio artifacts

Success condition:

- audience understands the audio deconstruction supports source review and strengthens the legal-finality story

## Demo checklist

Before running the demo, confirm:

- Node API is running
- frontend is running or built and served from Node
- Python backend is running if Demucs is part of the story
- FFmpeg is available
- ACRCloud credentials are present
- Gemini key is present if you want forensic + visual AI outputs
- Demucs / audio deconstruction backend is available if you want SAM audio deconstruction in the flow
- Google Places key is present if you want Google venue lookup
- mobile app is using the correct backend URL
- if radio evidence matters, use a native dev build, not Expo Go

## What should be considered "complete enough" for the demo

The demo is complete if all of these happen in one guided run:

- one real capture is created
- one real report is generated
- one analyst confirms it and applies a legal posture
- one authority can review it in the dashboard
- one case packet is exported
- the packet supports a legal-finality narrative
- admin can show system health and data controls

That is the minimum believable system story.

## What is still missing for a stronger demo

These are the main gaps between the current repo and a polished investor / partner demo.

### Mobile trust chain

- signed mobile capture payloads with a real device keypair
- stronger trust binding between account, install, and capture session
- server-side upload hash verification

Why it matters:

- this is one of the biggest remaining evidence-chain gaps

### Mobile resilience

- durable offline upload queue
- resumable upload / retry persistence
- better recovery after app termination

Why it matters:

- a polished field demo feels much stronger when capture survives bad networks

### Radio evidence realism

- no generalized nearby Wi-Fi scan
- no classic Bluetooth discovery
- BLE scanning requires native build

Why it matters:

- if the audience expects “device environment intelligence,” set expectations carefully

### Audio deconstruction depth

- audio deconstruction needs to be consistently present on the report, not just available through the Python side
- stems should be easier to inspect from the portal and authority views
- the system should better explain what the deconstruction adds to the legal conclusion

Why it matters:

- if SAM audio deconstruction is part of the story, it cannot feel bolted on

### Venue canonicalization depth

- Google Maps and Foursquare are now selectable, but venue merging is still basic
- no advanced dedupe or confidence fusion across providers yet

Why it matters:

- multi-provider venue selection is demo-ready, but not fully normalized for production

### Authority dashboard sophistication

- SVG coordinate clustering, not a real map
- no polygon/heatmap/city drilldown
- no true geospatial indexing

Why it matters:

- the current dashboard is useful, but still “v1 triage UI,” not a finished intelligence console

### Review workflow depth

- authority screen is read-heavy
- no full cross-role workflow orchestration
- no full escalation / closure state machine

Why it matters:

- for a stronger demo, reviewers should see clearer progression from report to action

### Legal-finality depth

- no formal legal conclusion template yet
- no explicit statute / violation basis summary
- no entitlement bundle proving why this rights owner can act
- no signed counsel-ready attestation layer
- no formal “ready for legal action” state separate from analyst review

Why it matters:

- the demo can tell a legal-finality story now, but the product still needs a stronger legal handoff layer for real-world use

### Rewards / contributor economics

- reward ledger exists
- no real payout execution
- no KYC or payment rail

Why it matters:

- for demo, this is fine
- for “crowdsourced contributor network” storytelling, it is still incomplete

## What is still missing beyond demo and into productization

These are not required for the demo, but they are still major product gaps:

- Postgres/object storage instead of local JSON/files
- real queueing and workers
- managed auth
- production deployment model
- stronger anti-fraud scoring
- audit logs suitable for external review
- legal handoff workflow
- mature permissions / privacy / moderation policy for public contributors
- native release pipeline instead of dev-build dependence
- formal legal workflow and outside-counsel handoff model

## Recommended demo cut

If time is limited, show this exact sequence:

1. Mobile sign-up and record one venue clip
2. Review screen with Google Maps / Foursquare toggle
3. Submit and wait for processing
4. Open the report in `/portal`
5. Show source analysis, SAM audio deconstruction, peak-frame analysis, evidence package
6. Apply a legal posture and export a case packet
7. Open the same report in `/authority`
8. Show coordinate cluster, quality band, and legal-finality view
9. End in `/admin` with health + imports

That is the highest-signal end-to-end story in the repo today.

## Practical recommendation

Do **not** try to demo every feature in one sitting.

Use one “hero flow” and treat the rest as supporting proof:

- hero flow: mobile capture -> processing -> portal legal review -> authority triage
- support proof: admin health, rewards model, audio deconstruction, radio evidence, imports

That produces the cleanest demo and avoids drowning the audience in unfinished edges.

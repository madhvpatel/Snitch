# Snitch India v1

Snitch is now structured as a two-sided evidence platform:

- `/capture`: anonymous mobile-web recorder for live 15–20 second venue clips
- `/portal`: org-scoped enforcement workspace for labels and collecting societies
- `/authority`: coordinate-led dashboard for authorities and outside enforcement users
- `/admin`: platform admin workspace for dependency health, abuse review, and imports

The landing page at `/` is only a surface chooser. The recorder, rights-holder portal, authority console, and admin workspace now render as separate page shells so each role has its own visual context and no shared cross-role navigation.

The current implementation uses local file-backed persistence and local JWT + TOTP auth so the full workflow can run end to end in development without provisioning Postgres, Supabase, or managed queues first.

## Product Shape

### Recorder

- Live in-browser recording only
- No gallery upload path on the production capture route
- Anonymous install identity backed by a locally stored P-256 WebCrypto key pair
- Optional invite-code linkage for the invite-only contributor network
- Start/end clock sync against the backend
- Geolocation snapshot at capture start and finalize
- Signed recorder payloads and SHA-256 media hashing
- Auto-stop at 20 seconds, manual stop unlocked after 15 seconds
- Deterministic Phase 1 source classification on extracted audio (`likely_pa_system` / `likely_small_speaker` / `likely_personal_device` / `inconclusive`)
- Reward eligibility only when the matched venue is verified as `unlicensed` or `expired` for the relevant rights layer

### Portal

- Org-scoped dashboard and report queue
- Venue metrics and repeat-offender scoring
- Report review actions
- Case-packet export
- Tariff-based recoverable value and case-ledger visibility
- Settlement/license-signing outcome capture for Stage 3 contributor bonuses

### Authority

- Coordinate-based segregation of visible reports
- Derived evidence-quality scoring and banding
- Cluster-level triage for venues and cities
- Read-heavy evidence-package drilldown for chain-of-custody, radio context, source analysis, and merchant linkage
- Case-packet export for selected reports

### Admin

- Dependency health view
- Abuse queue
- Catalog import
- Rights-owner import
- Venue coverage import
- Merchant master import
- License status import
- Tariff table import
- Contributor rewards overview

## Surface Separation

- `/capture` is the public recorder surface
- `/portal` is the rights-holder workspace
- `/authority` is the authority-facing evidence dashboard
- `/admin` is the platform-only workspace
- each route has its own page shell, badge, and visual treatment
- non-home routes only link back to `/`; they do not expose direct cross-links into the other role surfaces

## Local Architecture

- `src/`: React/Vite frontend with routed recorder, portal, authority, and admin experiences
- `server/`: Node API for capture, local persistence, auth, reporting, FFmpeg extraction, ACRCloud lookup, and Gemini summaries
- `python-backend/`: Demucs-backed Python worker service
- `server/data/platform-db.json`: local system-of-record JSON store created on first run
- `server/data/assets/`: raw video, derived audio, and case-packet asset storage

## Crowdsourced Rewards Model

The current prototype includes a local implementation of the invite-only contributor program:

- contributor invites are linked at recorder install-registration time
- merchant value is estimated from tariff anchors and planning bands, not merchant revenue
- GSTIN is stored as merchant verification data only
- cases become reward-eligible only when license status is `unlicensed` or `expired`
- Stage 1 and Stage 2 rewards are held automatically
- Stage 3 rewards are created when a portal user records a realized outcome

See [docs/crowdsourced-rewards-model.md](/Users/madhavpatel/Snitch_1/docs/crowdsourced-rewards-model.md) for the plain-language explanation.

See [docs/pa-source-classification.md](/Users/madhavpatel/Snitch_1/docs/pa-source-classification.md) for the current and proposed logic used to distinguish venue PA playback from personal-device playback.

Source-classification testing now supports two modes:

- `source-v1` for the preserved stable baseline
- `source-v2-fft` for the experimental FFT / third-octave + all-window distribution path

Pre-prod source-classification training export:

- `npm run export:source-training`
- `npm run export:source-training -- --reviewed-only`

See [docs/evidence-package.md](/Users/madhavpatel/Snitch_1/docs/evidence-package.md) for the structure of the exported evidence package and what is currently included.

See [docs/peak-frame-analysis.md](/Users/madhavpatel/Snitch_1/docs/peak-frame-analysis.md) for how the backend now extracts frames from stronger audio windows and uses them for visual evidence analysis.

See [docs/authority-dashboard.md](/Users/madhavpatel/Snitch_1/docs/authority-dashboard.md) for how the authority-facing dashboard organizes reports by coordinates and evidence quality.

See [docs/mobile-radio-evidence.md](/Users/madhavpatel/Snitch_1/docs/mobile-radio-evidence.md) for what the mobile app now collects for Wi-Fi and Bluetooth context, and what is still unsupported in the current build.

See [docs/end-to-end-demo-scope.md](/Users/madhavpatel/Snitch_1/docs/end-to-end-demo-scope.md) for the recommended full demo scope and the main remaining gaps.

See [docs/demo-purpose-changes.md](/Users/madhavpatel/Snitch_1/docs/demo-purpose-changes.md) for the list of demo-only presentation overrides and related local adjustments.

For mobile launch mode, use matching pairs:

- `npm run start:go` in [/Users/madhavpatel/Snitch_1/SnitchV1/frontend](/Users/madhavpatel/Snitch_1/SnitchV1/frontend) when opening the project in Expo Go
- `npm run start:dev-client` in [/Users/madhavpatel/Snitch_1/SnitchV1/frontend](/Users/madhavpatel/Snitch_1/SnitchV1/frontend) when opening the installed native development build

## Wi-Fi / Bluetooth Evidence

The browser recorder still does **not** include Wi-Fi or Bluetooth scanning.

The native mobile pilot now includes:

- current Wi-Fi connection context as evidence enrichment
- SSID/BSSID capture attempts in native iOS/Android builds
- nearby BLE scan results in native builds
- Google Maps / Foursquare venue lookup toggle during submission review
- explicit Bluetooth capability/status in the evidence package when scans are unavailable

It still does **not** include:

- generalized nearby Wi-Fi scans
- nearby BLE scans in Expo Go
- classic Bluetooth device discovery

Reference material:

- [MDN Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)
- [MDN Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Chrome Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth)

## Prerequisites

- Node.js 20+
- Python 3.10+
- FFmpeg on your `PATH` or configured via `server/.env`
- ACRCloud credentials for real track identification
- Optional: Gemini API key for forensic summaries and metadata enrichment
- Optional: Google Places API key for venue canonicalization

## Environment Setup

```bash
cp .env.example .env
cp server/.env.example server/.env
cp python-backend/.env.example python-backend/.env
```

Frontend:

```bash
# Optional. Leave unset to use same-origin `/api` and `/python`
# when the frontend is served by the Node app or shared through ngrok.
# VITE_API_BASE_URL=http://localhost:3001
# VITE_PYTHON_API_BASE_URL=http://localhost:5001
```

Server:

- `ACRCLOUD_HOST`
- `ACRCLOUD_ACCESS_KEY`
- `ACRCLOUD_ACCESS_SECRET`
- `GOOGLE_PLACES_API_KEY` optional
- `GEMINI_API_KEY` optional
- `PYTHON_AI_BASE_URL` defaults to `http://127.0.0.1:5001`
- `ALLOWED_ORIGIN`
- `FFMPEG_PATH`
- `PORTAL_JWT_SECRET`
- `SNITCH_DEMO_PASSWORD`
- `IP_HASH_SALT`

Python:

- `PYTHON_AI_PORT`
- `ALLOWED_ORIGIN`
- `DEMUCS_MODEL`

## Local HTTPS Dev Certs

To make camera/microphone capture work cleanly on both:

- `http://localhost`
- LAN URLs like `https://172.20.10.2:5173`
- hostnames like `https://Madhavs-MacBook-Pro.local:5173`

generate a local development certificate:

```bash
npm run certs:setup
```

That script uses `mkcert`, creates:

- `certs/dev-key.pem`
- `certs/dev-cert.pem`

and includes `localhost`, your current LAN IPs, and your machine hostname in the certificate.

Important:

- the generated cert is trusted automatically on your Mac after `mkcert -install`
- other devices on your LAN will still need to trust the `mkcert` root CA before the HTTPS URL is fully trusted there
- if your LAN IP changes, rerun `npm run certs:setup`

## Install

```bash
npm install
npm --prefix server install
cd python-backend && pip install -r requirements.txt
```

For browser automation:

```bash
npx playwright install chromium
```

## Run

Start the whole stack:

```bash
npm run dev:stack
```

Or run services separately:

```bash
npm run dev:frontend
npm run dev:server
cd python-backend && python3 app.py
```

If you want the frontend dev server over local HTTPS across LAN devices, run:

```bash
npm run certs:setup
npm run dev:frontend
```

If you want one shareable URL, build the frontend and let the Node app serve it:

```bash
npm run build
npm --prefix server start
ngrok http 3001
```

That setup serves the React app from the Node API, proxies Python AI requests under `/python`, and keeps browser traffic on one public origin.

## Local Demo Accounts

All seeded demo users use the password from `SNITCH_DEMO_PASSWORD`, defaulting to `snitch-demo-2026`.

- Portal label workspace: `label@saregama.demo`
- Portal collective workspace: `iprs@snitch.demo`
- Platform admin: `admin@snitch.local`

The server exposes seeded TOTP secrets at `GET /api/auth/demo-accounts` outside production so you can generate working codes locally.

## Quality Checks

```bash
npm run build
npm run lint
npm run test:smoke
npm run health:check
```

The smoke test now exercises:

- landing page and route navigation
- live recorder flow with mocked browser media APIs
- portal sign-in and case-packet export
- authority sign-in and report triage screen load
- admin sign-in and CSV import actions

## Current Implementation Notes

- Persistence is local JSON/file-backed, not Postgres/Supabase yet.
- Queueing is in-process, not `pg-boss` yet.
- Auth is local JWT + TOTP, not managed auth yet.
- Google Places and Gemini are optional enrichments.
- ACRCloud remains the primary real song-identification dependency.

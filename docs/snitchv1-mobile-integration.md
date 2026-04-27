# snitchv1 Mobile Integration

This note explains how `snitchv1` now connects to the root Snitch backend.

## What changed

Before:

- `snitchv1/frontend` expected the local FastAPI backend in `snitchv1/backend`

Now:

- `snitchv1/frontend` is wired to the root Node backend in `/server`

## Why

The root backend already owns the real platform concerns:

- capture data store
- submissions
- reports
- rewards and case ledger
- portal/admin workflows
- ACRCloud / FFmpeg / Demucs integration

Keeping a second backend for the mobile app would split the product into two incompatible systems.

## New root backend routes for the mobile app

- `/api/mobile/auth/signup`
- `/api/mobile/auth/login`
- `/api/mobile/auth/me`
- `/api/mobile/capture/install`
- `/api/mobile/capture/session`
- `/api/mobile/capture/session/:id/start`
- `/api/mobile/capture/submissions`
- `/api/mobile/capture/submissions/:id/upload`
- `/api/mobile/capture/submissions/:id/finalize`
- `/api/mobile/capture/submissions/:id/status`
- `/api/user/profile`
- `/api/user/submissions`
- `/api/user/rewards`
- `/api/user/trust`
- `/api/health`

## Environment

Set the Expo app to point at the root backend explicitly.

Local simulator example:

```bash
EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
```

Physical phone example on the same Wi-Fi:

```bash
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.23:3001
```

Important:

- `localhost` works only when the device running the app can actually reach the backend on itself
- on a physical phone, `localhost` points to the phone, not your Mac
- if you are testing on a phone, use your Mac LAN IP or a public tunnel instead

## Launch modes

The mobile app now has two distinct local run modes:

### Expo Go preview

Use this when you want quick mobile validation without a native build:

```bash
cd /Users/madhavpatel/Snitch_1/SnitchV1/frontend
EXPO_PUBLIC_BACKEND_URL=https://YOUR-BACKEND-URL npm run start:go
```

What this means:

- Metro launches in `Expo Go` mode
- open the QR code with `Expo Go`
- BLE scanning is unavailable
- SSID / BSSID collection is limited

### Native development build

Use this for the native radio-evidence path and any build that depends on native-only modules:

```bash
cd /Users/madhavpatel/Snitch_1/SnitchV1/frontend
npx expo run:ios --device
```

Then:

```bash
cd /Users/madhavpatel/Snitch_1/SnitchV1/frontend
EXPO_PUBLIC_BACKEND_URL=https://YOUR-BACKEND-URL npm run start:dev-client
```

What this means:

- Metro launches for a custom native app, not Expo Go
- open the installed app on the phone
- use this mode for nearby BLE scans and the best chance of SSID / BSSID capture

If you open Expo Go against a `--dev-client` Metro session, or open the installed dev app against a `--go` Metro session, Expo commonly shows `Could not connect to server` even though your backend is fine.

## What is real now

The current `snitchv1` mobile path now includes:

- mobile sign up / sign in on the root backend
- install registration on the root backend
- real Expo camera recording flow in the mobile app
- real foreground geolocation capture at start/end
- persisted GPS accuracy at start/end
- nearby venue suggestions based on the captured coordinates
- explicit user venue selection during submission review
- Google Maps / Foursquare toggle for nearby venue lookup during review
- radio evidence capture for current Wi-Fi context plus nearby BLE scan results in native builds
- real local file-backed capture review
- real multipart upload to the root backend mobile upload route
- stored raw-video asset records in the root platform store
- finalize now queues the same root submission-processing pipeline used by the web capture flow
- mobile submissions now run through FFmpeg extraction, ACRCloud lookup, report creation, and Phase 1 source classification
- upload/detail screens now poll processing status until backend analysis finishes

## Nearby venue selection

During mobile submission review, the app now:

- calls the root backend `/api/nearby-venues` endpoint with the capture coordinates
- lets the user switch between `Google Maps` and `Foursquare`
- shows a list of possible venues near that location for the chosen provider
- marks the backend's best match, but does **not** auto-select it
- lets the user explicitly pick one before submitting
- still allows manual venue entry if the lookup is wrong or empty

This matters because the old review flow silently treated the first suggestion as selected. The new flow keeps the provider visible and makes venue choice explicit.

The selected venue is persisted with the mobile submission and is used as the preferred venue context during backend processing.

## What is still missing

This is **not** the full final evidence chain yet.

Still pending:

- signed mobile capture payloads using a device key pair
- stronger trust binding between mobile accounts and installs
- robust offline upload queue / retry persistence
- generalized nearby Wi-Fi enumeration

So the mobile pilot now uses the right backend and the main processing queue, but it is still a pilot-stage capture path rather than the finished enforcement-grade mobile recorder.

## Radio evidence

The mobile app now carries a `radioEvidence` block from the capture flow into the backend.

What is stored today:

- Wi-Fi current connection context
- SSID / BSSID / strength / frequency when the platform exposes them
- nearby BLE scan results when a native build can run them
- Bluetooth capability/status and a clear reason when nearby BLE scanning is unavailable
- start and end snapshots so the evidence package can show whether radio context changed during capture

What this does **not** mean:

- the app is not doing a full nearby Wi-Fi scan
- the app is not discovering classic Bluetooth audio devices
- Expo Go still cannot run nearby BLE scans

That distinction is intentional. The evidence package now shows what was really observable in this build instead of pretending a scan happened.

## Processing-state refresh fix

There was a mobile UX bug where the app could show:

- `Song Identified: Pending`
- `Source Class: Pending`

even though the backend finished processing a few seconds later.

What happened:

- the upload flow finalized the submission
- the app fetched status immediately
- backend analysis was still running asynchronously
- the detail screen rendered that early snapshot and never refreshed

What changed:

- the upload screen now waits and polls while backend processing is still in progress
- the submission-detail screen also keeps polling while the status is still `received`, `uploaded`, or `processing`
- the backend status endpoints now send `Cache-Control: no-store` so processing views are not stuck behind stale cached responses

## Upload timeout over ngrok or mobile data

There was also a mobile upload bug where a real video upload could fail with:

- `Upload timed out`

What happened:

- the mobile API client used the same `10s` timeout for normal JSON requests and multipart video uploads
- that is too short for a `15–20s` video file, especially over ngrok or slower mobile networks

What changed:

- normal API requests still use the short timeout
- video uploads now use a much longer timeout window
- the upload error copy now explains that tunnels and mobile networks can be slower

## Recent debugging note

One real mobile integration bug was that the Expo client called `/api/capture/time` with `POST`, while the root backend serves that route as `GET`.

Effect:

- sign-in could work
- live capture could fail immediately with a generic request/network error during the time-sync step

Fix:

- the mobile client now calls `/api/capture/time` with `GET`, which matches the root backend contract

## Compatibility layer

To reduce breakage from the older `snitchv1/backend` scaffold contract, the root backend now tolerates a few legacy/mobile variations:

- `/api/capture/time` now works with both `GET` and `POST`
- `/api/mobile/capture/time` also exists as a compatibility alias
- time-sync responses now include both:
  - `serverTime`
  - `server_time`
  - `unix_ms`
- mobile auth signup accepts both:
  - `displayName` and `display_name`
  - `referralCode` and `referral_code`
- mobile install/session/submission routes accept both snake_case and camelCase payload fields
- auth now fails visibly if mobile device registration fails, instead of silently logging in and breaking later during capture

## Recording duration bug on real devices

There was a mobile-only bug where a contributor could record for the full `20` seconds and still get:

- `Recording was too short`

What happened:

- the capture screen used the visible UI timer state as the source of truth
- on a real device, `recordAsync()` can finish before the React state used by that timer is fully up to date
- that made a valid long recording look short

What changed:

- the capture flow now tracks recording length from wall-clock start and end time
- the UI timer is still shown, but it is no longer the authority for proof validation
- stop-unlock and finalize validation now both use the real elapsed duration

File:

- [snitchv1/frontend/app/live-capture.tsx](/Users/madhavpatel/Snitch_1/snitchv1/frontend/app/live-capture.tsx)

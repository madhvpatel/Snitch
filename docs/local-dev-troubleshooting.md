# Local Dev Troubleshooting

This file explains the recent fixes in simple language.

## 1. Why the browser kept showing `content.js` warnings

Those warnings are not from Snitch.

Examples:

- `Video element not found for attaching listeners`
- `A listener indicated an asynchronous response...`
- CSP errors mentioning `chrome-extension://...`

They come from a browser extension trying to inject scripts into the page. Snitch did not create those logs.

What to do:

- Ignore them, or
- disable that extension on `localhost` while testing

## 2. Why the app showed `ERR_CONNECTION_REFUSED`

The frontend calls:

- `http://localhost:3001` for the Node API
- `http://localhost:5001` for the Python AI service

If either service is not running, the browser shows `ERR_CONNECTION_REFUSED`.

What changed:

- the Node API was restarted with the new routes and CORS rules
- the Python service was changed so `/health` still starts even if Demucs is missing

Files:

- [server/index.js](/Users/madhavpatel/Snitch_1/server/index.js)
- [python-backend/app.py](/Users/madhavpatel/Snitch_1/python-backend/app.py)

## 3. Why CORS failed on `http://localhost:5174`

The original API only trusted `http://localhost:5173`.

When Vite moved to `5174`, the browser blocked requests.

What changed:

- the API now allows the common local dev origins by default
- the Python service does the same

That includes:

- `http://localhost:4173`
- `http://localhost:5173`
- `http://localhost:5174`
- `http://127.0.0.1` versions of the same ports

## 3b. Why the public ngrok page still failed after it loaded

When Snitch was opened through the public ngrok URL, the browser sent:

- `Origin: https://...ngrok-free.dev`

The Node API still only trusted local dev origins, so the API rejected the request even though the page itself was loading from the same public tunnel.

What changed:

- the API now also allows common public tunnel origins like:
  - `https://*.ngrok-free.dev`
  - `https://*.ngrok.app`
  - `https://*.trycloudflare.com`
- the frontend now shows the actual HTTP status when a request fails, instead of only saying `Request failed`

Files:

- [server/index.js](/Users/madhavpatel/Snitch_1/server/index.js)
- [src/services/platformApi.js](/Users/madhavpatel/Snitch_1/src/services/platformApi.js)

## 4. Why login returned `401 Unauthorized`

The portal/admin demo accounts originally showed only the TOTP secret, not the actual 6-digit code needed for login.

What changed:

- the backend now exposes a **current** demo TOTP code in local development
- the portal and admin login screens show that code and provide a quick-fill button

Files:

- [server/platformAuth.js](/Users/madhavpatel/Snitch_1/server/platformAuth.js)
- [server/index.js](/Users/madhavpatel/Snitch_1/server/index.js)
- [src/pages/PortalPage.jsx](/Users/madhavpatel/Snitch_1/src/pages/PortalPage.jsx)
- [src/pages/AdminPage.jsx](/Users/madhavpatel/Snitch_1/src/pages/AdminPage.jsx)

## 5. Why capture upload returned `400 Bad Request`

There were two separate problems.

### Problem A: MIME type validation was too strict

Browsers sometimes send recorder files as:

- `video/webm;codecs=vp9,opus`
- or even `application/octet-stream`

The backend originally only accepted exact strings like `video/webm`.

What changed:

- Snitch now strips codec parameters like `;codecs=...`
- if the upload arrives as `application/octet-stream`, it falls back to:
  - the MIME type declared when the submission was created, or
  - the file extension like `.webm`

### Problem B: repeated uploads were treated as an error

If an upload partially succeeded and the client retried, the backend used to return another `400`.

What changed:

- the upload endpoint is now idempotent for already-uploaded submissions
- if the same submission is uploaded again and the asset already exists, the API returns the existing asset instead of failing

File:

- [server/index.js](/Users/madhavpatel/Snitch_1/server/index.js)

### Problem C: file existed on disk but the asset record was missing

This was the deeper bug behind the message:

- `Error: Raw video asset missing`

What happened:

- the upload route wrote the file to disk
- but the JSON database entry for that file could be lost because of nested writes to the local store
- later, processing looked in the JSON store, could not find the asset record, and failed even though the `.webm` file was still present

What changed:

- asset persistence was split so file writing and asset-record registration are safer
- processing now tries to rebuild a missing asset record from the existing file on disk
- failed submissions can now be retried after repair

Files:

- [server/platformStore.js](/Users/madhavpatel/Snitch_1/server/platformStore.js)
- [server/index.js](/Users/madhavpatel/Snitch_1/server/index.js)

## 6. Why the admin page showed `403 Forbidden`

If the browser still had a **portal** token in local storage, the admin page tried to call admin-only endpoints before confirming that the token belonged to a platform admin.

What changed:

- the admin page now checks `/api/auth/me` first
- it only calls admin-only endpoints after confirming the user is a platform admin

File:

- [src/pages/AdminPage.jsx](/Users/madhavpatel/Snitch_1/src/pages/AdminPage.jsx)

## 6b. Why ngrok showed `502 Bad Gateway` with `Unexpected end of JSON input`

This was a backend crash, not an ngrok outage.

What happened:

- the Node API keeps its local demo data in `server/data/platform-db.json`
- multiple requests could read/write that file at nearly the same time
- because the store wrote directly to the live JSON file, one request could read it while another write was still in progress
- that produced:
  - `SyntaxError: Unexpected end of JSON input`
  - backend process crash
  - ngrok `502 Bad Gateway`
  - mobile app message: `Request failed`

What changed:

- writes to the platform DB are now **atomic**
  - write to a temp file first
  - then rename it into place
- store mutations are now **serialized**
  - only one mutation writes the DB at a time
- if the live JSON file is unreadable, the backend now:
  - saves a copy of the corrupt file for inspection
  - tries to recover from `platform-db.bak.json`
  - falls back to a fresh seeded DB only if no valid backup exists

File:

- [server/platformStore.js](/Users/madhavpatel/Snitch_1/server/platformStore.js)

## 7. Why Demucs now comes from the repo copy

The original Python backend tried to import `demucs.api` from its own virtualenv.

That failed because the local `python-backend/venv` had a different Demucs build that did not include that module.

What changed:

- the Python backend now looks first at the vendored runtime in `Demucs-Gui/venv`
- it prepends that `site-packages` directory to `sys.path`
- health now reports which Demucs runtime is active

What this means:

- the separation feature now uses the repo-bundled Demucs environment
- the Python service can still run from `python-backend/venv`, but it loads Demucs from `Demucs-Gui/venv`

Files:

- [python-backend/app.py](/Users/madhavpatel/Snitch_1/python-backend/app.py)
- [python-backend/.env.example](/Users/madhavpatel/Snitch_1/python-backend/.env.example)

## 8. Commands to run locally

Node API:

```bash
cd /Users/madhavpatel/Snitch_1/server
npm start
```

Python service:

```bash
cd /Users/madhavpatel/Snitch_1/python-backend
./venv/bin/python app.py
```

Vendored Demucs runtime used by the Python service:

```bash
cd /Users/madhavpatel/Snitch_1/Demucs-Gui
./venv/bin/python - <<'PY'
import demucs.api
print(demucs.api.__file__)
PY
```

## 9. Practical rule while testing

After backend changes:

1. restart the API
2. hard-refresh the frontend
3. start a fresh capture instead of reusing an old page state

If a submission already failed because of a backend bug, use the new **Retry Processing** button on the capture status card after refresh.

## 10. Why iPhone now says `User denied Geolocation`

This is usually a good sign: it means the request is now reaching the real browser permission layer instead of failing earlier on CORS or tunnel setup.

There are also a few iPhone-specific rules worth knowing:

- the page must be loaded over `https://` (or `localhost` in local testing)
- the location request should begin from a button tap, not on page load
- Private Browsing can make permissions less reliable
- Chrome on iPhone still uses the same WebKit engine as Safari, so it does not bypass Safari-style location behavior

In the current recorder flow, location is mandatory in two places:

- during **Prepare Device**
- again when **Start Live Capture** begins

So if iPhone Safari denies location for the website, the flow stops even if camera and microphone are allowed.

What to check on iPhone:

1. Make sure **Location Services** is on:
   - `Settings > Privacy & Security > Location Services`
2. Make sure Safari websites are not globally denied:
   - `Settings > Apps > Safari > Location`
   - choose `Ask` or `Allow`, not `Deny`
3. For the specific site:
   - open the site in Safari
   - tap the page/settings menu in the address bar
   - open website settings
   - set **Location** to `Allow` or `Ask`
4. If you previously tapped **Don’t Allow**, Safari may remember that choice for the site until you change it.
5. If the permission state feels stuck, reset it:
   - `Settings > General > Transfer or Reset iPhone > Reset > Reset Location & Privacy`

One practical detail:

- if you chose **Allow Once**, iPhone can ask again on the next session
- if the ngrok domain changes, iPhone treats that as a different site and will ask again

## 11. Why the app says `Live capture needs HTTPS`

The recorder blocks before it even asks for camera access if the browser reports:

- `window.isSecureContext === false`

That means the page is not running in a browser context that iPhone trusts for camera/microphone recording.

Common causes:

1. The page was opened over plain `http://` instead of `https://`
2. The phone opened the app on a LAN IP like `http://192.168.x.x:5174`
3. The page is inside an embedded browser or in-app webview instead of Safari or Chrome
4. The browser is still on a stale tunnel warning/interstitial page instead of the real app

What changed:

- the recorder error now includes the current page origin and protocol so you can see exactly what the phone loaded

What to do:

1. Open the page directly in Safari or Chrome
2. Make sure the address starts with `https://`
3. Do not use a local network URL for live capture on iPhone
4. If using a tunnel, pass any warning page and then hard-refresh

## 12. How local HTTPS dev certs now work

Snitch now has a repeatable local certificate setup instead of relying on one hardcoded `localhost` cert name.

Use:

```bash
cd /Users/madhavpatel/Snitch_1
npm run certs:setup
```

What it does:

- installs the local `mkcert` root CA on your Mac
- generates:
  - `certs/dev-key.pem`
  - `certs/dev-cert.pem`
- includes:
  - `localhost`
  - `127.0.0.1`
  - `::1`
  - your machine hostname
  - your current LAN IPv4 addresses

Why this matters:

- `http://localhost:5173` is usually fine already
- `http://192.168.x.x:5173` is not a secure context
- after generating the cert, Vite can serve HTTPS for LAN URLs too, so camera and microphone work more reliably across devices

One important limit:

- other phones, tablets, or laptops on your network still need to trust the `mkcert` root CA before they will fully trust your local HTTPS URL
- so this solves the certificate coverage problem, but not cross-device trust automatically

On this Mac, the root CA lives at:

- `/Users/madhavpatel/Library/Application Support/mkcert/rootCA.pem`

For iPhone/iPad:

1. copy `rootCA.pem` to the device
2. open it and install the profile
3. go to `Settings > General > About > Certificate Trust Settings`
4. enable full trust for that root certificate

After that, LAN URLs such as `https://172.20.10.2:5173` can be trusted by Safari/Chrome on that device too.

What changed in the app:

- the recorder now starts the geolocation request immediately from the button tap before slower async work
- if high-accuracy lookup times out or the position is temporarily unavailable, it retries once with lower accuracy
- the UI now marks location as `requesting` while the browser is still working on the permission/fix
- the recorder no longer waits on a preliminary permission-state query before asking for location, because even that extra async hop can make iPhone treat the request as no longer directly tied to the tap

Files:

- [src/pages/CapturePage.jsx](/Users/madhavpatel/Snitch_1/src/pages/CapturePage.jsx)

## 11. Why the iPhone camera light could be on but the preview stayed blank

There was also a recorder-flow bug in the app itself.

What happened:

- `Prepare Device` asked for camera/mic and geolocation at the same time
- if iPhone granted camera but the location request failed, the whole step rejected
- the preview never finished initializing
- the camera stream could still remain active in the browser tab

That creates the exact confusing state:

- camera indicator looks active
- no live preview appears
- the error still says geolocation was denied

What changed:

- the app now starts the location request directly from the button tap, before slower async steps
- the preview explicitly calls `play()` after attaching the stream
- the camera stream is only kept if both permission steps succeed
- the start-recording path now shows the same clearer location message

File:

- [src/pages/CapturePage.jsx](/Users/madhavpatel/Snitch_1/src/pages/CapturePage.jsx)

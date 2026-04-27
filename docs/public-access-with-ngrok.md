# Public Access With ngrok

This project can now be shared with one public URL without exposing separate frontend, API, and Python service URLs.

## What changed

Before this change, the browser tried to call:

- `http://localhost:3001` for the Node API
- `http://localhost:5001` for the Python AI service

That works only on the same machine. On someone else's phone or laptop, `localhost` points to their own device, so the app breaks.

The fix was:

1. the frontend now defaults to same-origin requests
2. the Node app can serve the built frontend from `dist/`
3. the Node app proxies Python AI requests under `/python`
4. ngrok only needs to expose port `3001`
5. the API must explicitly allow the public tunnel origin, not just `localhost`

## Result

One public URL now handles:

- the React app
- `/api/*` requests
- `/media/*` assets
- `/python/*` AI requests

## Local commands

Build and serve:

```bash
npm run build
npm --prefix server start
```

Open the tunnel:

```bash
ngrok http 3001
```

## What to expect

- `/` loads the surface chooser
- `/capture` works over the same public URL
- `/portal` and `/admin` also use the same public origin
- `/python/health` is proxied through the Node app

## Important limits

- This is still a development tunnel, not a production deployment
- The Python service now prefers the repo-bundled Demucs runtime in `Demucs-Gui/venv`, so isolation depends on that vendored environment remaining intact
- Local demo auth is still dev-mode behavior, so do not treat a public ngrok link as a secure production environment
- On ngrok free plans, browser visitors may first hit the `ERR_NGROK_6024` warning page before they reach the app

## Why the browser may show CSS or manifest MIME errors

If a visitor opens the ngrok URL in a browser and sees errors like:

- stylesheet refused because MIME type is `text/html`
- manifest syntax error
- random `500`-looking page load failures

the usual cause is the ngrok free-tier browser warning page, not Snitch.

What is happening:

1. the browser asks for the app page
2. ngrok serves its HTML warning/interstitial page first
3. the browser then tries to load app asset URLs expecting CSS or JSON
4. if those requests still receive ngrok HTML, the browser reports MIME errors

What to do:

- open the public ngrok URL directly in a browser
- pass the ngrok warning page once
- after the visitor clicks through, ngrok sets a cookie and stops showing that warning for that domain for about 7 days

If you need the browser warning removed entirely:

- upgrade to a paid ngrok plan, or
- use a different public tunnel/deployment path for browser traffic

Official references:

- [ERR_NGROK_6024 docs](https://ngrok.com/docs/errors/err_ngrok_6024/)
- [Free plan limits and browser warning behavior](https://ngrok.com/docs/pricing-limits/free-plan-limits/)

## Simple mental model

Think of the Node app as the public front door.

- The browser talks only to the Node app
- The Node app serves the React app
- The Node app forwards AI requests to the Python service
- ngrok exposes only the Node app to the internet

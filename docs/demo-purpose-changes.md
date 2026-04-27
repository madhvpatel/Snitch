# Demo-Purpose Changes

This document records changes that exist to improve a live demo and that should be reviewed before treating the current behavior as product truth.

## Current demo-only behavior

### 1. Presentation-only signature override

- Controlled by `DEMO_FORCE_SIGNATURE_VERIFIED` in [`server/.env.example`](/Users/madhavpatel/Snitch_1/server/.env.example).
- When set to `true`, the backend presents `captureIntegrity.signatureStatus` as `signed_and_verified` in the evidence package.
- This is a presentation override for demo use.
- It does **not** mutate the raw submission field `hasValidSignature`.
- Purpose:
  - allows the authority and analyst dashboards to show a cleaner, stronger chain-of-custody story in demos
  - preserves the underlying raw truth so real signing work can still be implemented later

## Non-demo but recently adjusted behavior

### 2. Device trust band no longer collapses because of missing signature

- The backend trust-band calculation was changed so device trust reflects:
  - install abuse score
  - clock skew
- It no longer automatically becomes `low` just because a payload signature is missing.
- Reason:
  - payload-signature validity and device-level trust are separate concepts
  - showing both as failed in the UI double-penalized the same packet and made the demo harder to read

## Data repair utility

### 3. Recompute stored trust bands for existing reports

- Script: [`server/scripts/recompute-device-trust-bands.mjs`](/Users/madhavpatel/Snitch_1/server/scripts/recompute-device-trust-bands.mjs)
- Example:

```bash
cd /Users/madhavpatel/Snitch_1/server
node scripts/recompute-device-trust-bands.mjs --install-id=<install-id>
```

- Purpose:
  - updates already-stored reports so the dashboards match the current trust-band logic

## Demo operation note

If you want the demo UI to show verified signatures, run the backend with:

```bash
cd /Users/madhavpatel/Snitch_1/server
DEMO_FORCE_SIGNATURE_VERIFIED=true npm run dev
```

Or set:

```bash
DEMO_FORCE_SIGNATURE_VERIFIED=true
```

in `server/.env` for local demo sessions.

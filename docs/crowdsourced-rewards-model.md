# Crowdsourced Rewards Model

This project now includes a working prototype of the invite-only contributor economics model.

## What changed

- Recorder installs can optionally link to a contributor invite code.
- The backend stores five new business ledgers:
  - `merchantMaster`
  - `licenseStatus`
  - `tariffTable`
  - `caseLedger`
  - `rewardLedger`
- Every processed report is evaluated against:
  - matched venue
  - matched rights owner
  - imported or derived merchant data
  - imported or derived license status
  - tariff-based recoverable value

## Reward eligibility

A contributor can only earn rewards when all of these are true:

1. the recorder install is linked to a valid invite-only contributor
2. the evidence package passes normal processing
3. the venue is matched
4. the rights layer is matched
5. the venue is marked `unlicensed` or `expired` for that rights owner
6. the proof is the primary usable proof in the case window

If license status is unknown, the case is still tracked, but no reward is created automatically.

## Reward stages

- Stage 1:
  - created automatically for the primary qualifying proof
  - default amount: `INR 125`
  - status starts as `held`
- Stage 2:
  - created when an analyst confirms the case
  - amount depends on venue segment
  - status starts as `held`
- Stage 3:
  - created when the portal records a realized outcome such as a settlement or license signing
  - amount is a capped percentage of realized value
  - status starts as `held`

## Why GSTIN is stored

GSTIN is used here as a merchant verification and dedupe field.

It is **not** used as:

- the main revenue estimator
- the payout basis
- proof of music-license status

That matches the business rule decided for this build: estimate case value from tariffs and planning bands, not merchant turnover.

## How to use the prototype

1. In `/capture`, enter a valid invite code before preparing the device.
2. In `/admin`, import:
   - merchant master rows
   - license status rows
   - tariff rows
3. Capture a proof.
4. In `/portal`, review the report.
5. If the case is confirmed and later realized, record the outcome from the report detail panel.

## Important limitation

This is still a local prototype:

- persistence is JSON-backed
- payout statuses are ledger states only
- no real payment rail exists yet
- no GST or license data is fetched automatically from external systems

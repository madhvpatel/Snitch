# Authority Dashboard

## What this screen is for

The authority dashboard is the web screen for outside enforcement or government users who need to:

- see all visible reports in one place
- separate reports by where they happened
- understand how strong each evidence package is
- export selected reports into a case packet

This screen is available at `/authority`.

## How it organizes reports

The dashboard does not create a new backend data model. It reorganizes the existing report payload from the portal APIs into three practical views:

1. **Coordinate clusters**
   - Reports are grouped into rounded latitude/longitude buckets.
   - This creates a fast geographic segregation view without waiting for a full map stack.
   - Each cluster shows report count, dominant venue, city, and average quality.

2. **Evidence quality bands**
   - Every visible report gets a derived quality score from `0` to `100`.
   - The score is then bucketed into:
     - `Strong`
     - `Good`
     - `Review`
     - `Weak`

3. **Evidence detail**
   - Authorities can inspect chain-of-custody, coordinates, song/source analysis, radio context, GSTIN linkage, and recoverable value in one panel.

## What goes into the quality score

The current score is based on the evidence we already store:

- capture duration
- start/end coordinates
- GPS accuracy
- media hash presence
- raw video and derived audio availability
- song match confidence
- source-analysis confidence
- venue match
- merchant / GSTIN linkage
- license state being actionable

This is not a legal verdict. It is a triage score so authorities can quickly focus on stronger packets first.

## Why coordinate buckets instead of a full map

The current version uses an SVG coordinate canvas rather than a third-party map library because:

- it keeps the screen lightweight
- it works with the report data already available
- it avoids adding a new provider dependency before the layout and workflow are proven

If you later want street maps or heatmaps, this page is the right place to add them.

## Current limits

- It uses the same auth/session model as the portal.
- It reads the existing `/api/portal/dashboard` and `/api/portal/reports` payloads.
- It does not add new review actions; it is intentionally read-heavy.
- Geographic clustering is approximate because it is based on rounded coordinates, not true geospatial indexing.

## Files involved

- [src/pages/AuthorityPage.jsx](/Users/madhavpatel/Snitch_1/src/pages/AuthorityPage.jsx)
- [src/App.jsx](/Users/madhavpatel/Snitch_1/src/App.jsx)
- [src/components/platform/AppShell.jsx](/Users/madhavpatel/Snitch_1/src/components/platform/AppShell.jsx)
- [src/pages/HomePage.jsx](/Users/madhavpatel/Snitch_1/src/pages/HomePage.jsx)
- [src/services/platformApi.js](/Users/madhavpatel/Snitch_1/src/services/platformApi.js)

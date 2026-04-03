# D1–D9 Life Pattern Analyzer — UI-mirrored rebuild

This rebuild follows the earlier dark UI structure and keeps the project deployment-friendly for Git.

## File structure

```text
functions/
  api/
    analyze.js
README.md
app.js
index.html
styles.css
```

## What changed in this version

- Mirrors the earlier UI direction instead of the simplified layout
- Removes Tamil toggle
- Uses manual typed planet entry house-wise
- Replaces score-heavy presentation with insight / feedback wording
- Moves Mahadasha Watch Zone into its own tab
- Restores the Restraint life factor
- Saves sessions in browser localStorage so history stays after closing the browser
- Downloads the report as a Word-compatible `.doc` file

## How it works

- `index.html` → UI structure
- `styles.css` → mirrored dark theme styling
- `app.js` → front-end behavior, validation, save/load history, report download
- `functions/api/analyze.js` → backend-style analysis endpoint for Cloudflare Pages Functions

## Important note for local testing

If you open `index.html` directly as a file, POST requests to `functions/api/analyze.js` will not work the same way as a hosted environment.

Use one of these:
- Cloudflare Pages
- local dev environment that supports functions routing

## Deploy on Cloudflare Pages

- Build command: leave blank
- Build output directory: `/`
- Functions directory: `functions`

## Current scope limits

This app does not yet:
- auto-calculate D1 or D9 from DOB / time / place
- calculate actual mahadasha dates
- generate packaged `.docx`
- translate to Tamil

The report download is a Word-compatible `.doc` export, which opens in Microsoft Word.


## Fix in v3.1

- Front-end API call corrected to `/api/analyze`
- Added safer JSON parsing with clearer error display when the function route is not active


## Fix in v3.2

- Function now uses a generic `onRequest` handler instead of method-specific exports
- Added `OPTIONS` handling and permissive headers
- Keeps `/api/analyze` as the route

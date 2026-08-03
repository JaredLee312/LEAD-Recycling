# BinFinderSG — Recycling Bin Locator

A static site (Singapore) that helps users find the nearest blue bin, e-waste point,
or textile bin, and report issues (full/damaged) on any of them. No build step —
plain HTML/CSS/JS, opened directly or served as static files.

## Structure

```
index.html          Homepage — 3 category buttons (Blue Bins / E-Waste / Textile)
blue-bin.html        List page for blue (paper/plastic/glass/metal) bins
e-waste.html          List page for e-waste bins
textile.html          List page for textile/clothing bins
css/main.css          Shared: reset, header, footer, card layout, CSS variables
css/home.css           Homepage-only: category button grid + backgrounds
css/list.css            List-page-only: search bar, bin cards, report modal
js/list.js               Renders bin list, town search, distance sort, report UI wiring
js/reports.js             Supabase client, report modal, submit/fetch logic
js/supabase-config.js       SUPABASE_URL + SUPABASE_ANON_KEY (safe to commit — public key)
assets/*.jpg               Homepage button background photos
supabase-setup.sql          One-time SQL to run in a new Supabase project (see below)
```

Each list page is self-contained: header/copy + a `<script>` block at the bottom
with a hardcoded JS array of `{ name, address, region, lat, lng }` objects, passed to
`initBinList(data, category)` where `category` is `'blue-bin' | 'e-waste' | 'textile'`.

## Data source

Bin locations are **not** fetched live in the browser. NEA's own locator at
recycle.gov.sg has a tRPC API (`/api/trpc/recyclingPoints.filteredWithinRadius`) with
real, live bin data — but it has no CORS headers, so the browser can't call it
directly from this site. Instead, the data was pulled **server-side** (Python
scripts, one-time) across ~20 town-center coordinates and baked into each page's
JS array:

- Blue bin: 285 sampled locations (nearest ~15 per town) — the real dataset has
  11,800+ near those towns alone, and NEA states 80,000+ islandwide, so this is
  deliberately a curated sample, not the full set.
- E-waste: 532 locations — effectively the complete set found.
- Textile: 398 locations — effectively the complete current Cloop network.

Region tags (`Central / East / North / North-East / West`) and the "Near X,
Singapore" address text were derived by finding each point's nearest of 20 town
centers (see `TOWN_CENTERS` in `js/list.js`), not from an official field.

**To add another category** (e.g. Glass, Beverage/BCRS — both material types
already exist in that same API): re-run the same server-side pull filtered for
the new material type, generate a JS array in the same shape, copy one of the
existing list HTML pages as a template, add a homepage button + accent color.
See the "Design system" section below for the color/CSS pattern to follow.

## Location search (no geolocation)

There's no browser geolocation — it was deliberately removed. Instead
`js/list.js` has a hardcoded `TOWN_CENTERS` array (20 towns, all 5 regions). The
single search input doubles as a town picker via a native `<datalist>`: if the
typed text exactly matches a known town name, results are sorted by distance
from that town's coordinates; otherwise it falls back to a plain text filter
over name/address/region.

## Design system

CSS variables live in `css/main.css`. Each category has its own accent pair
(`--blue`/`--blue-dark`, `--ewaste`/`--ewaste-dark`, `--textile`/`--textile-dark`).
List pages set `--accent` inline in `<head>` to point at the right pair, and
`css/list.css` styles (buttons, tags, report modal) reference `var(--accent,
var(--green))` throughout — so a new category only needs one new variable pair
plus one `<style>:root{--accent:...}</style>` line, not new CSS rules.

The header uses `position: relative` (for the back-link button); `main` also
needs `position: relative; z-index: 1` or the header renders on top of the
card due to CSS stacking rules for positioned vs. static elements — don't
remove that without checking for the header-overlap bug it caused before.

## Reporting system (Supabase backend)

Users can report a bin as full/damaged/other, with an optional photo, from any
list page ("Report an issue" button on each bin card). This is backed by a
real Supabase project (free tier, Singapore region):

- Table `bin_reports` (see `supabase-setup.sql`) — category, bin identity
  (`bin_id` = `lat.toFixed(6) + '_' + lng.toFixed(6)`, computed client-side,
  not a DB foreign key), report type, description, photo URL, timestamp.
- Storage bucket `bin-report-photos`, public.
- RLS policies allow public (anon) INSERT and SELECT on both — **there is no
  login system**, so this is intentionally open. Anyone can post a report;
  no one (other than via the Supabase dashboard) can delete one.
- Basic spam control: `js/reports.js` enforces a 60-second cooldown between
  submissions per browser (via `localStorage`, see `REPORT_COOLDOWN_MS`).
  This is a UX-level deterrent, not real security — it's trivially bypassed
  by clearing storage or using a different browser/device. A real fix would
  be server-side (e.g. a Supabase Edge Function rate-limiting by IP, or a
  CAPTCHA) — not currently implemented, and worth calling out honestly as a
  known gap rather than a solved problem.
- The photo upload bucket enforces file type (`image/jpeg|png|webp|gif`
  only) and a 5 MB size limit **server-side**, via `file_size_limit` /
  `allowed_mime_types` on the `bin-report-photos` bucket (see
  `supabase-setup.sql`) — this can't be bypassed by skipping the app's own
  UI and calling the Storage API directly, unlike the cooldown above.
- `js/supabase-config.js` holds the Project URL and **anon/publishable** key
  (safe to expose client-side by design — never put the `service_role` key
  here). If `js/reports.js` can't find real values there, it fails soft: no
  report badges show, and the modal shows "Reporting isn't set up yet"
  instead of erroring.

To add reporting support for a new category, add its slug to the
`bin_category` CHECK constraint on `bin_reports` (one `ALTER TABLE` in the
Supabase SQL editor).

## Privacy & PDPA alignment

This is a deliberate data-minimization design, not an accident:

- **No accounts, ever.** There is no login, no name field, no email field,
  anywhere in the app — including on the report form. We don't ask for
  identity because no feature actually needs it.
- **What `bin_reports` actually stores**: which bin, what type of issue
  (full/damaged/other), an optional free-text description, an optional
  photo, and a timestamp. That's the full set of columns — see
  `supabase-setup.sql`. None of it identifies the reporter.
- **Photos are the one residual risk.** A photo could incidentally capture
  a bystander's face or a vehicle plate even though we don't ask for that.
  The report form shows a standing notice ("Photos are visible to everyone.
  Please avoid capturing people, faces, or vehicle license plates.") right
  above the upload field — a UI control, not just a policy statement.
- **No tracking beyond what Supabase's infrastructure logs by default**
  (e.g. request IPs at the hosting layer) — the application itself does not
  read, store, or display IP addresses, device IDs, or any other
  identifier tied to a person.
- **Why this matters for PDPA**: Singapore's Personal Data Protection Act
  obligates minimizing collection to what's necessary for the stated
  purpose. Since "report a bin as full" has no legitimate need for who is
  reporting it, not collecting identity isn't just simpler — it's the
  compliant choice, and it also shrinks the Defense-pillar attack surface
  (a breach of `bin_reports` exposes no PII, because there isn't any).

If a future feature genuinely needs identity (e.g. a moderation dashboard
restricted to admins), that should be scoped as its own auth system with
its own justification — not bolted onto the public reporting flow.

## Running it locally

No build step. Either open the HTML files directly, or serve the folder so
`fetch`/relative paths behave like production:

```
python -m http.server 8743
```

(There's also a `.claude/launch.json` one level up configured for this, if
using Claude Code's preview tooling.)

## Tests

The site itself still has no build step and ships with zero dependencies —
Vitest is a **dev-only** tool for running the test suite, it's never loaded
by the actual pages. Requires Node.js.

```
npm install
npm test
```

`js/list.js` and `js/reports.js` end with a small `if (typeof module !==
'undefined') { module.exports = {...} }` block — this only runs under
Node/Vitest (`module` doesn't exist in a browser `<script>` tag), so it
exports the pure logic functions for testing without changing anything
about how the pages actually load these files. Two things were pulled out
of inline handlers into standalone functions specifically to make them
unit-testable: `selectAndSortBins()` in `list.js` (the search/filter/sort
logic) and `validateReportForm()` / `validatePhotoFile()` in `reports.js`
(the report form's validation rules). If you change what those rules are,
update `tests/list.test.js` / `tests/reports.test.js` to match — that's
the whole point of having them.

## Known limitations (by design, not bugs)

- Blue bin list is a sample, not exhaustive — the note on that page and this
  file both say so; don't "fix" it by trying to cram in all 80,000+.
- No user accounts anywhere (bin reports or otherwise) — this was an explicit
  scope decision, not an oversight.
- Report photos and rows are never auto-deleted/moderated.

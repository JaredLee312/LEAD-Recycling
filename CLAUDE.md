# BinFinderSG — Recycling Bin Locator

A static site (Singapore) that helps users find the nearest blue bin, e-waste point,
or textile bin, and report issues (full/damaged) on any of them. No build step —
plain HTML/CSS/JS, opened directly or served as static files. Browsing/searching is
fully open to anyone; submitting a report or a recycling log entry requires signing
in (email + password + mandatory TOTP two-factor authentication).

## Structure

```
index.html          Homepage — 4 category buttons (Blue Bins / E-Waste / Textile / BCRS)
                    + a link to analytics.html
blue-bin.html        List page for blue (paper/plastic/glass/metal) bins
e-waste.html          List page for e-waste bins
textile.html          List page for textile/clothing bins
bcrs.html             List page for BCRS beverage container return points
analytics.html         Community recycling counters (month / year / all-time) + log form
login.html              Sign in / sign up / MFA enrollment / MFA challenge, all one page
css/main.css          Shared: reset, header, footer, card layout, CSS variables,
                     .auth-status header widget (logged-in email + log out button)
css/home.css           Homepage-only: category button grid + backgrounds
css/list.css            List-page-only: search bar, bin cards, report modal
css/analytics.css        Analytics-page-only: log form, stat tiles, material breakdown bars
css/auth.css             login.html-only: tabs, form fields, MFA QR/code screens
js/list.js               Renders bin list, town search, distance sort, report UI wiring
js/reports.js             Report modal, submit/fetch logic for bin_reports (login-gated)
js/analytics.js            Recycling log form, totals math, material breakdown (login-gated)
js/auth.js                 Sign up/in/out, session state, MFA enroll/challenge/verify,
                          renderAuthStatus() (the header widget, used on every page)
js/login-page.js            Screen-switching controller for login.html only
js/supabase-config.js       SUPABASE_URL + SUPABASE_ANON_KEY + getSupabaseClient() — shared
                           by reports.js, analytics.js, and auth.js (safe to commit, public key)
assets/*.jpg|png            Homepage button background photos
supabase-setup.sql          One-time SQL to run in a new Supabase project (see below)
```

Each list page is self-contained: header/copy + a `<script>` block at the bottom
with a hardcoded JS array of `{ name, address, region, lat, lng }` objects, passed to
`initBinList(data, category)` where `category` is
`'blue-bin' | 'e-waste' | 'textile' | 'bcrs'`.

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
- BCRS (beverage container return points): 927 locations — effectively the
  complete set found. All 4 categories' raw data came from a single API pull
  (`materialTypes` on each record distinguishes them), so adding BCRS required
  no new API calls, just reprocessing data already on disk.

Region tags (`Central / East / North / North-East / West`) and the "Near X,
Singapore" address text were derived by finding each point's nearest of 20 town
centers (see `TOWN_CENTERS` in `js/list.js`), not from an official field.

**To add another category** (e.g. Glass — the one remaining material type
already present in that same API pull): reprocess the cached raw data filtered
for `GLASS` in `materialTypes`, generate a JS array in the same shape, copy
`bcrs.html` as a template, add a homepage button + accent color (see "Design
system" below), and add the category slug to the `bin_category` CHECK
constraint on `bin_reports` (see `supabase-update-add-bcrs-category.sql` for
the pattern — same idea, different value).

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

Users can report a bin as full/damaged/other, with a **compulsory** photo,
from any list page ("Report an issue" button on each bin card). This is
backed by a real Supabase project (free tier, Singapore region):

- Table `bin_reports` (see `supabase-setup.sql`) — category, bin identity
  (`bin_id` = `lat.toFixed(6) + '_' + lng.toFixed(6)`, computed client-side,
  not a DB foreign key), report type, description, photo URL, timestamp.
- Storage bucket `bin-report-photos`, public.
- RLS: SELECT is public (`to public`, no login needed to browse reports).
  INSERT requires an authenticated session (`to authenticated`) — see
  "Authentication & MFA" below. No one (other than via the Supabase
  dashboard) can delete a report, logged in or not.
- Before the report modal opens, `openReportModal()` in `js/reports.js`
  calls `isFullyAuthenticated()`; if that's false it redirects to
  `login.html?redirect=<current page>` instead of opening the form. This
  is a UX convenience, not the real enforcement — the RLS policy above is
  what actually blocks it at the database level even if someone bypasses
  the UI entirely.
- **A photo is required**, enforced by `validateReportForm()`'s `hasPhoto`
  check — submission is blocked with "Please attach a photo of the bin."
  if none is attached. Max size is **10 MB**, enforced both client-side
  (`validatePhotoFile()`, see `MAX_PHOTO_BYTES`) and server-side on the
  storage bucket itself (`file_size_limit` in `supabase-setup.sql` —
  verified by bypassing the UI and calling the Storage API directly).
- **Reports are only shown for 24 hours** after submission. `js/reports.js`
  filters them out twice: once in the Supabase query itself (`.gte('created_at',
  cutoff)`) and again client-side (`isReportVisible()`), as a defensive
  double-check against clock/timezone drift. Rows are **not deleted** —
  they still exist in the database (there's no public delete permission,
  by design — see above), they just stop being fetched/displayed. If a
  report genuinely needs to be removed, that's done manually via the
  Supabase dashboard.
- Basic spam control: `js/reports.js` enforces a 60-second cooldown between
  submissions per browser (via `localStorage`, see `REPORT_COOLDOWN_MS`).
  This is a UX-level deterrent, not real security — it's trivially bypassed
  by clearing storage or using a different browser/device. A real fix would
  be server-side (e.g. a Supabase Edge Function rate-limiting by IP, or a
  CAPTCHA) — not currently implemented, and worth calling out honestly as a
  known gap rather than a solved problem.
- `js/supabase-config.js` holds the Project URL and **anon/publishable** key
  (safe to expose client-side by design — never put the `service_role` key
  here). If `js/reports.js` can't find real values there, it fails soft: no
  report badges show, and the modal shows "Reporting isn't set up yet"
  instead of erroring.

To add reporting support for a new category, add its slug to the
`bin_category` CHECK constraint on `bin_reports` (one `ALTER TABLE` in the
Supabase SQL editor).

## Community recycling analytics

`analytics.html` is a **shared, public counter** — every logged-in user's
entry adds to totals everyone sees (including logged-out visitors, who can
view but not submit), not a personal/per-user counter. This was a
deliberate choice made before login existed and hasn't changed since:
accounts exist now to gate *who* can submit, not to give each person their
own private tally — a community total tells a real aggregate-impact story
that a scattered set of personal counters wouldn't.

- Table `recycling_log` — `material` (one of the 7 values in
  `RECYCLING_MATERIALS`, `js/analytics.js`), `quantity` (positive integer,
  meaning number of items, not weight), `created_at`. Same RLS pattern as
  `bin_reports`: SELECT is public, INSERT requires an authenticated
  session, no delete for anyone.
- **No aggregation happens in the database.** `fetchRecyclingRows()` pulls
  every row (`material`, `quantity`, `created_at`) and `computeTotals()`
  sums them client-side into month/year/all-time buckets and a per-material
  breakdown. This is simple and fully unit-tested, but doesn't scale
  indefinitely — if this table ever grows very large, the fix is a
  Postgres view or an RPC function that aggregates server-side instead.
- Month/year boundaries are calendar-based (1st of the current month / 1st
  of January), computed from the viewer's local clock via `new Date()` —
  not timezone-aware in any special way, just whatever the browser's local
  time is.
- The note on the page itself says these are self-reported, unverified
  numbers — a community engagement tally, not an audited statistic. Don't
  remove that caveat; it's an intentional Legal-Tech-style honesty choice,
  same spirit as the "sample, not exhaustive" notes on the bin list pages.

## Authentication & MFA

Browsing, searching, and viewing reports/analytics never requires an
account. Submitting a report or a recycling log entry does. This is
**Supabase Auth** (email + password) plus **mandatory TOTP MFA** — not
anything hand-rolled. We never see, store, or touch a plaintext password
or a password hash anywhere in this codebase; `authSignUp`/`authSignIn` in
`js/auth.js` just call `client.auth.signUp()`/`signInWithPassword()` and
Supabase handles the rest.

- **Flow**: sign up (email + password) → if email confirmation is off
  (see below), the user gets a session immediately and is walked straight
  into **mandatory** MFA enrollment (scan a QR code or enter a secret in
  any TOTP authenticator app, then confirm a 6-digit code) before they're
  considered logged in. Signing in again later prompts for that 6-digit
  code every time (an MFA *challenge*, not re-enrollment).
- **Assurance levels**: Supabase tracks this as `aal1` (password verified)
  vs `aal2` (password + MFA verified). `isFullyAuthenticated()` in
  `js/auth.js` is the single source of truth the rest of the app checks —
  it returns true only at `aal2` for users who have an MFA factor, so a
  password-only session is never treated as "logged in" for submission
  purposes.
- **Email confirmation**: this project has it turned **off** in the
  Supabase dashboard (Authentication → Providers → Email), so sign-up
  flows straight into MFA setup instead of blocking on a confirmation
  email. If you turn it back on, `authSignUp()` already handles that case
  gracefully — `login.html` shows a "check your email" screen instead of
  starting MFA enrollment when no session comes back immediately.
- **The header widget** (`renderAuthStatus()`, called on every page except
  `login.html`) shows "Log in" when logged out, or the user's email +
  "Log out" when logged in — this is what's in `.auth-status` in the
  header of every page.
- **Gotcha worth knowing**: the QR code Supabase returns
  (`data.totp.qr_code`) is a `data:image/svg+xml` URI that contains
  literal `"` characters from the SVG's own XML attributes. Building the
  `<img>` tag via string concatenation (`'<img src="' + qr_code + '">'`)
  silently breaks — the embedded quotes close the `src="..."` attribute
  early and the rest spills out as broken markup. Fix: create the `<img>`
  element with `document.createElement` and set `.src` as a **property**,
  not an HTML attribute string (see `startMfaEnrollment()` in
  `js/login-page.js`). Found and fixed by actually rendering it and
  looking at the broken output, not by reading the docs.

## Privacy & PDPA alignment

This is still a deliberate data-minimization design — adding login changed
what's collected, but not the underlying discipline:

- **Accounts now exist, scoped narrowly.** Signing in requires only an
  email and password — nothing else (no name, no phone number, no profile
  fields). This is the one place personal data enters the app at all, and
  it exists specifically to gate spam on public write actions (see
  Defense notes on `bin_reports`/`recycling_log` below), not for its own
  sake. Browsing/searching/viewing never asks for anything.
- **Passwords never touch our code.** Supabase Auth owns password
  hashing, storage, and verification entirely; `js/auth.js` only ever
  calls its API methods. There is nothing in this repo — client or
  server-side SQL — that could leak a password even in a worst-case
  breach, because we never had one to leak.
- **MFA secrets are the same story.** The TOTP secret is generated and
  stored by Supabase's auth system, not in any table this app controls.
- **What `bin_reports` actually stores**: which bin, what type of issue
  (full/damaged/other), an optional free-text description, a required
  photo, and a timestamp. No column links a report to the account that
  submitted it — see `supabase-setup.sql`. Being logged in is required to
  *write* a row, but the row itself still doesn't identify who wrote it.
- **What `recycling_log` actually stores** (the analytics feature): a
  material name, a quantity, and a timestamp. Same non-attribution as
  above — login gates the action, not the data.
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
  purpose. An email+password is necessary to prevent anonymous spam on
  public write actions — that's a real, statable purpose, unlike (say)
  collecting a name or phone number "just in case." The reports and log
  entries themselves still carry no identity, which is what keeps a
  worst-case database breach from exposing PII beyond email addresses.

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
logic), `validateReportForm()` / `validatePhotoFile()` in `reports.js`
(the report form's validation rules), `computeTotals()` /
`validateLogEntry()` in `analytics.js`, and `validateAuthForm()` /
`validateMfaCode()` in `auth.js`. If you change what those rules are,
update the matching test file to match — that's the whole point of having
them. Anything that needs a live network call (Supabase auth/DB calls,
MFA enrollment itself) is intentionally left untested here — that's
covered by manual live verification instead, not unit tests.

## Known limitations (by design, not bugs)

- Blue bin list is a sample, not exhaustive — the note on that page and this
  file both say so; don't "fix" it by trying to cram in all 80,000+.
- Login exists only to gate submissions — there's no profile, no "my
  reports" view, no password reset flow built into the UI (Supabase Auth
  supports one; this app just doesn't have a page for it), no admin/mod
  tooling. This was scoped narrowly on purpose.
- Report photos and rows are never auto-deleted/moderated.
- MFA is TOTP-only (authenticator apps) — no SMS/phone factor, since that
  needs a paid Twilio-style integration this project doesn't have.

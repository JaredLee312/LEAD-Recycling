# BinFinderSG — Recycling Bin Locator

A static site (Singapore) that helps users find the nearest blue bin, e-waste point,
or textile bin, and report issues (full/damaged) on any of them. No build step —
plain HTML/CSS/JS, opened directly or served as static files. Browsing/searching is
fully open to anyone; submitting a report or a recycling log entry requires signing
in (email + password + mandatory TOTP two-factor authentication).

## Structure

```
index.html          NEW site entry point — a welcome/landing page with the sign
                    in / sign up / MFA form embedded directly on it (email + password).
                    Already-authenticated visitors see a "You're logged in" screen
                    with a Continue button through to home.html.
home.html            The actual bin-finder homepage — 4 category buttons (Blue Bins /
                    E-Waste / Textile / BCRS) + link cards to analytics.html and
                    info.html. My Reports and Privacy Policy are deliberately NOT
                    link cards here (kept the page from feeling cluttered) — My
                    Reports lives in the header auth-status widget (top right, every
                    page) and Privacy Policy in the footer (every page). Requires
                    login to view (redirects to login.html if visited directly
                    without a session); reached from index.html after signing in.
blue-bin.html        List page for blue (paper/plastic/glass/metal) bins
e-waste.html          List page for e-waste bins
textile.html          List page for textile/clothing bins
bcrs.html             List page for BCRS beverage container return points
analytics.html         Community recycling counters (month / year / all-time) + log form
info.html               Static "Recycling Guide" page — what's accepted/not accepted in
                       each bin category, plus general sorting tips. No login required,
                       no JS logic beyond the shared header/footer markup. Linked from
                       both homepages: a button on index.html and a link card on
                       home.html (back-link always returns to index.html).
login.html              A second, compact sign in / sign up / MFA page — used when an
                       already-browsing visitor tries to submit a report or log entry
                       without being signed in (redirects here with ?redirect=<page>,
                       distinct from and independent of index.html's embedded form)
my-reports.html          "My Reports" — a signed-in user's own bin reports, with edit
                       and delete actions. Requires login to view (same gate pattern
                       as home.html); linked only from the auth-status header widget
                       (top right, every page) — deliberately not a link card on
                       home.html, to keep that page from feeling cluttered.
privacy.html             Privacy Policy — what's collected, why, retention, security
                       measures, and how to access/update/delete your data. No login
                       required. Linked from the footer of every page (including
                       home.html — deliberately not a link card there), from a data
                       notice above every sign-in/sign-up form, and from the consent
                       checkbox on sign-up.
assistant.html           "Recycling Assistant" — upload/take a photo of an item, a free
                       image-recognition model running in the browser guesses whether
                       it's recyclable and which bin category. No login required (no
                       server call at all — nothing to gate). Linked from a link card
                       on home.html, but reachable directly like info.html.
css/main.css          Shared: reset, header, footer, card layout, CSS variables,
                     .auth-status header widget (logged-in email, My Reports, log out)
css/home.css           home.html-only: category button grid + backgrounds
css/info.css            info.html-only: accept/avoid column lists, category accent borders
css/privacy.css          privacy.html-only: bullet list styling
css/welcome.css         index.html-only: hero icon strip
css/list.css            List-page-only: search bar, bin cards, report modal (also
                       reused by my-reports.html for its edit-report form)
css/my-reports.css       my-reports.html-only: report card layout, edit/delete buttons
css/analytics.css        Analytics-page-only: log form, stat tiles, material breakdown bars
css/auth.css             Shared by index.html and login.html: tabs, form fields, MFA
                       QR/code screens, the data-collection notice above the tabs,
                       and the sign-up consent checkbox
css/assistant.css         assistant.html-only: chat bubble layout, photo preview
js/list.js               Renders bin list, town search, distance sort, report UI wiring
js/reports.js             Report modal, submit/fetch/update/delete logic for bin_reports
                        (login-gated); also fetchMyReports() and photoStoragePathFromUrl(),
                        shared with my-reports.js and validatePhotoFile()/MAX_PHOTO_BYTES
                        shared with assistant.html's photo picker
js/my-reports.js           Renders/edits/deletes the signed-in user's own reports on
                        my-reports.html
js/assistant.js             Recycling assistant logic: loads the mobilenet model, runs
                          classification on a photo, mapLabelToCategory() keyword lookup
js/assistant-page.js         Chat UI wiring for assistant.html (DOM-only, no exports)
js/analytics.js            Recycling log form, totals math, material breakdown (login-gated)
js/auth.js                 Sign up/in/out, session state, MFA enroll/challenge/verify,
                          renderAuthStatus() (the header widget, used on every page)
js/login-page.js            Screen-switching controller, shared by index.html and login.html
                           (DOM-ID driven, not page-specific — works on either page's markup).
                           Redirects to ?redirect=<page> after login, or home.html by default.
js/supabase-config.js       SUPABASE_URL + SUPABASE_ANON_KEY + getSupabaseClient() — shared
                           by reports.js, analytics.js, and auth.js (safe to commit, public key)
assets/*.jpg|png            home.html button background photos
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
  not a DB foreign key), report type, description, photo URL, `user_id`,
  timestamp.
- Storage bucket `bin-report-photos`, public.
- RLS: SELECT is public (`to public`, no login needed to browse reports).
  INSERT requires an authenticated session (`to authenticated`) — see
  "Authentication & MFA" below.
- **Ownership and self-service edit/delete** (`supabase-update-add-report-ownership.sql`):
  `bin_reports.user_id` defaults to `auth.uid()` at insert time — the client
  never sets it, so it can't be spoofed to someone else's id (the INSERT
  policy's `with check` enforces `auth.uid() = user_id` too). UPDATE and
  DELETE policies are scoped the same way (`using (auth.uid() = user_id)`),
  so a user can only ever touch their own reports; this is enforced at the
  database level, not just hidden in the UI. Reports submitted before this
  migration have no `user_id` on record and so are nobody's to edit/delete
  via the app — that's expected, not a bug. Storage's built-in `owner`
  column (auto-set by Supabase on upload) gets the same treatment for the
  photo itself, via a delete policy on `storage.objects` scoped to
  `owner = auth.uid()`.
- **`my-reports.html`** is where this happens: lists the signed-in user's
  own reports (`fetchMyReports()`, filtered by `user_id` — ignores the
  24h public-visibility window entirely, since that's about hiding old
  reports from *other* people, not from their own author), with inline
  Edit (report type + description only — the photo itself isn't
  re-uploadable, only removable via deleting the whole report) and Delete
  (`deleteBinReport()` removes the storage photo first via
  `photoStoragePathFromUrl()`, then the row).
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

## Recycling Assistant (client-side photo classification)

`assistant.html` lets anyone upload/take a photo of an item and get a
guess: recyclable or not, and which bin category. This used to call Claude
through a Supabase Edge Function (see git history —
`supabase/functions/classify-recyclable`, removed) but was deliberately
rearchitected to run at **zero ongoing cost**, since a school project has
no budget for a recurring API bill. That constraint shapes everything
about how this feature works:

- **Runs entirely in the visitor's browser** via `@tensorflow-models/mobilenet`
  (loaded from a CDN in `assistant.html`, alongside its `@tensorflow/tfjs`
  dependency) — a free, general-purpose 1000-category image classifier. No
  API key, no server, no signup, no bill, ever. The tradeoff for that is
  real: it's matching against everyday object labels ("water bottle",
  "cellular telephone"), not reasoning about the photo the way a vision-LLM
  call would, so it can't handle ambiguous, damaged, or composite items
  well and can't write a genuinely custom explanation.
- **`mapLabelToCategory()` in `js/assistant.js`** is the actual "intelligence"
  layered on top of the model's raw output — a keyword lookup translating
  ImageNet labels onto BinFinderSG's four categories (blue-bin/e-waste/
  textile keyword lists; BCRS isn't a separate keyword set because the
  model can't see a deposit-refund logo, so bottle/can matches only ever
  get a soft "you could also check BCRS" hint, never a primary BCRS
  verdict). This is the piece most likely to misfire — a mismatch here
  usually means adding/adjusting a keyword, not a model problem.
- **No login required.** The only reason this feature was ever gated
  (`requireAuthOrRedirect()`, matching home.html/my-reports.html) was that
  each query was a real, billed API call — an unrestricted entry point
  would've been a direct cost-abuse funnel. That reason no longer applies
  once classification runs locally with no server round-trip, so the gate
  was removed along with the client-side query cooldown that existed for
  the same reason. It's public like `info.html` now.
- **Stronger privacy than before, as a side effect**: the photo is never
  uploaded anywhere — not to us, not to a third party — since everything
  happens in-memory in the browser tab. The disclaimer on the page says so
  explicitly, and this is genuinely a privacy improvement worth keeping if
  this feature is ever rearchitected again.
- **Photo validation is reused, not reimplemented**: `assistant.html`
  includes `js/reports.js` and calls its `validatePhotoFile()` /
  `MAX_PHOTO_BYTES` directly, so the 10MB/image-type rule stays in exactly
  one place.
- **The guess can be wrong**, and the page says so twice — a standing
  disclaimer above the chat area explaining *why* (general-purpose model,
  not a recycling-specific one), and a short caveat under every individual
  result. Same honesty pattern as the "self-reported, not audited" note on
  analytics and the "sample, not exhaustive" note on bin lists.
- **First use loads a small model bundle** (a few MB, cached by the browser
  after the first download) — `js/assistant.js` lazy-loads it on first
  submit rather than on page load, and the chat shows "Loading the
  assistant for the first time…" so that delay doesn't look like a bug.

## Authentication & MFA

Two different gates, don't conflate them:

1. **`home.html` (the bin-finder homepage) requires login to view at all.**
   This is a deliberately narrow scope choice — just this one page, not the
   whole site (see the next point).
2. **Submitting a report or a recycling log entry requires login**,
   regardless of which page you got there from.

The bin list pages (`blue-bin.html`, `e-waste.html`, `textile.html`,
`bcrs.html`) and `analytics.html` do **not** require login to view —
someone with a direct link can still browse/search them freely, they just
can't submit anything without signing in. Only `home.html` itself blocks
viewing entirely. This was an explicit, deliberate scope choice (asked
and confirmed) — don't "fix" it into whole-site gating without checking
first, and don't remove the gate assuming it was accidental.

All of this is **Supabase Auth** (email + password) plus **mandatory TOTP
MFA** — not anything hand-rolled. We never see, store, or touch a
plaintext password or a password hash anywhere in this codebase;
`authSignUp`/`authSignIn` in `js/auth.js` just call
`client.auth.signUp()`/`signInWithPassword()` and Supabase handles the rest.

- **Two login surfaces, one shared controller**: `index.html` (the site's
  entry point) has the full sign in / sign up / MFA form embedded directly
  on the page — that's what "the new homepage has login built in" means in
  practice. `login.html` is a separate, compact version of the exact same
  form, used as a redirect target whenever someone tries to submit a report
  or log entry without a session (`login.html?redirect=<page>`). Both pages
  share identical form markup (same element IDs) and are driven by the same
  `js/login-page.js` — it's DOM-ID driven, not page-specific, so it works
  unmodified on either page. Don't let the two pages' logic drift apart by
  editing one and not the other; if the login flow changes, it changes in
  `js/login-page.js` (or `js/auth.js`) once, not per-page.
- **Where login leads**: after a successful sign-in/verify, both pages
  redirect to `?redirect=<page>` if present, else default to `home.html`
  (`getRedirectTarget()` in `js/login-page.js`). Visiting `index.html`
  while already fully authenticated shows a "You're logged in" screen with
  a Continue button through to `home.html`, rather than silently
  auto-navigating — same pattern `login.html` already used.
- **The `home.html` gate**: it starts with everything except a "Checking
  your login…" message hidden (`.gate-hidden` on `<header>` and `<main>`,
  toggled via CSS `display: none`). The bottom-of-page script calls
  `requireAuthOrRedirect()` — if not fully authenticated, it redirects to
  `login.html?redirect=%2Fhome.html` and the real content is never
  revealed; if authenticated, it un-hides `header`/`main` and hides the
  loading message. This avoids a flash of real content before a redirect
  fires, at the cost of a brief "Checking your login…" state every time —
  acceptable for a client-side-only gate like this.

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
- **There's a real Privacy Policy** (`privacy.html`) covering what's
  collected, why, retention, security measures, and how to exercise your
  rights — not just this CLAUDE.md section. It's linked from the footer of
  every page, from a data-collection notice sitting above every sign-in/
  sign-up form (`.auth-data-notice` in `css/auth.css`), and from the
  sign-up form's consent checkbox itself.
- **Sign-up requires active consent, not implied consent.** The sign-up
  form has a required checkbox ("I agree to the Privacy Policy") — leaving
  it unchecked blocks account creation client-side via `validateAuthForm()`
  (`js/auth.js`), same validation path as the email/password checks. This
  only applies to `mode: 'signup'`; signing back in never re-asks for it.
- **No GPS or IP-based location tracking, and the Privacy Policy says so
  explicitly.** Town search matches typed text against the hardcoded
  `TOWN_CENTERS` list (see "Location search" above) — the browser is never
  asked for location permission, and nothing about where a visitor
  physically is gets read, sent, or stored.
- **Passwords never touch our code.** Supabase Auth owns password
  hashing, storage, and verification entirely; `js/auth.js` only ever
  calls its API methods. There is nothing in this repo — client or
  server-side SQL — that could leak a password even in a worst-case
  breach, because we never had one to leak.
- **MFA secrets are the same story.** The TOTP secret is generated and
  stored by Supabase's auth system, not in any table this app controls.
- **What `bin_reports` actually stores**: which bin, what type of issue
  (full/damaged/other), an optional free-text description, a required
  photo, a timestamp, and — as of the "My Reports" feature — a `user_id`
  linking the row to the account that submitted it (see
  `supabase-update-add-report-ownership.sql`). This is a deliberate
  narrowing of the earlier "reports don't identify who wrote them" design:
  the tradeoff is that self-service edit/delete requires knowing which
  reports are whose. The `user_id` is only ever used for that ownership
  check (RLS `auth.uid() = user_id`) and to power the user's own
  "My Reports" list — it's never shown publicly alongside a report, and
  reports from before this feature have no `user_id` at all.
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
- **Retention is stated honestly, not aspirationally.** `privacy.html`
  says reports/photos live until self-deleted via My Reports or removed
  after a manual account-deletion request, recycling log entries are kept
  indefinitely (they're anonymous, so there's nothing to purge per-user),
  and there is **no automated inactive-account deletion** — that's called
  out as a real gap rather than promising a retention window we don't
  actually enforce. Same honesty pattern as the spam-cooldown and
  no-CAPTCHA gaps noted elsewhere in this doc.
- **Access/update/delete rights are split between self-service and manual,
  and the Privacy Policy is upfront about which is which.** Reports:
  fully self-service via My Reports (view/edit/delete, enforced by RLS,
  see above). Account itself (change email/password, full deletion): no
  self-service page exists for this yet — `privacy.html` gives a real
  contact (`bensimjy@gmail.com`) and a 30-day commitment instead of
  hiding the gap.
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

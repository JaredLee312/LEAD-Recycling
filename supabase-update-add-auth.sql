-- Run this in the Supabase SQL Editor to require login for submitting
-- reports and recycling log entries. Browsing/reading stays public.
--
-- Note: SELECT policies are widened from "to anon" to "to public" because
-- once users can be authenticated, their requests run as the "authenticated"
-- role, not "anon" -- a policy scoped only to anon would silently stop
-- logged-in users from reading data. "public" covers both.

drop policy if exists "Public can read reports" on bin_reports;
create policy "Public can read reports"
  on bin_reports for select
  to public
  using (true);

drop policy if exists "Public can submit reports" on bin_reports;
create policy "Logged-in users can submit reports"
  on bin_reports for insert
  to authenticated
  with check (true);

drop policy if exists "Public can view report photos" on storage.objects;
create policy "Public can view report photos"
  on storage.objects for select
  to public
  using (bucket_id = 'bin-report-photos');

drop policy if exists "Public can upload report photos" on storage.objects;
create policy "Logged-in users can upload report photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bin-report-photos');

drop policy if exists "Public can read recycling log" on recycling_log;
create policy "Public can read recycling log"
  on recycling_log for select
  to public
  using (true);

drop policy if exists "Public can submit recycling log" on recycling_log;
create policy "Logged-in users can submit recycling log"
  on recycling_log for insert
  to authenticated
  with check (true);

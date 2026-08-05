-- Run this in the Supabase SQL Editor to let signed-in users see, edit,
-- and delete only the bin reports they personally submitted. Safe to run
-- once. Existing reports (submitted before this migration) have no owner
-- on record, so they simply won't be editable/deletable by anyone --
-- that's expected, not a bug.

alter table bin_reports add column if not exists user_id uuid references auth.users(id) default auth.uid();

-- Replace the old insert policy so a report's user_id can never be spoofed
-- to someone else's id: the row's user_id (via the column default above,
-- or if a client sets it explicitly) must match the submitter's own auth id.
drop policy if exists "Public can submit reports" on bin_reports;
drop policy if exists "Logged-in users can submit reports" on bin_reports;
create policy "Logged-in users can submit reports"
  on bin_reports for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own reports"
  on bin_reports for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own reports"
  on bin_reports for delete
  to authenticated
  using (auth.uid() = user_id);

-- Supabase Storage automatically records the uploader as `owner` on every
-- object, so this lets a user delete their own report photo (as part of
-- editing/removing their report) without granting delete on anyone else's.
drop policy if exists "Users can delete own report photos" on storage.objects;
create policy "Users can delete own report photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bin-report-photos' and owner = auth.uid());

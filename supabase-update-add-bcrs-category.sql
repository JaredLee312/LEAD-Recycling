-- Run this in the Supabase SQL Editor to allow the new "bcrs" category on
-- your existing bin_reports table. Safe to run once; does not affect
-- existing rows or policies.

alter table bin_reports drop constraint bin_reports_bin_category_check;

alter table bin_reports add constraint bin_reports_bin_category_check
  check (bin_category in ('blue-bin', 'e-waste', 'textile', 'bcrs'));

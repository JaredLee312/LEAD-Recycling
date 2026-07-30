-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query)

create extension if not exists pgcrypto;

create table if not exists bin_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bin_category text not null check (bin_category in ('blue-bin', 'e-waste', 'textile')),
  bin_id text not null,
  bin_name text not null,
  lat double precision not null,
  lng double precision not null,
  report_type text not null check (report_type in ('full', 'damaged', 'other')),
  description text,
  photo_url text
);

create index if not exists bin_reports_bin_id_idx on bin_reports (bin_category, bin_id);

alter table bin_reports enable row level security;

create policy "Public can read reports"
  on bin_reports for select
  to anon
  using (true);

create policy "Public can submit reports"
  on bin_reports for insert
  to anon
  with check (true);

-- Storage bucket for report photos
insert into storage.buckets (id, name, public)
values ('bin-report-photos', 'bin-report-photos', true)
on conflict (id) do nothing;

create policy "Public can view report photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'bin-report-photos');

create policy "Public can upload report photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'bin-report-photos');

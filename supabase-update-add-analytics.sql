-- Run this in the Supabase SQL Editor to add the community recycling
-- analytics feature. Safe to run once.

create table if not exists recycling_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  material text not null check (material in (
    'Paper', 'Plastic', 'Glass', 'Metal', 'E-Waste', 'Textile', 'Beverage Containers'
  )),
  quantity integer not null check (quantity > 0)
);

alter table recycling_log enable row level security;

create policy "Public can read recycling log"
  on recycling_log for select
  to anon
  using (true);

create policy "Public can submit recycling log"
  on recycling_log for insert
  to anon
  with check (true);

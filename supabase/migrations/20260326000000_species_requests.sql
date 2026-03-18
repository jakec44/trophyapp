-- species_requests: user requests for new fish species to be added to the passport
create table if not exists public.species_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  species_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_species_requests_created_at
  on public.species_requests(created_at desc);

create index if not exists idx_species_requests_species_name
  on public.species_requests(lower(trim(species_name)));

-- RLS: users can insert their own requests; anyone authenticated can read (to show aggregated list)
alter table public.species_requests enable row level security;

create policy "Users can insert own species requests"
  on public.species_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Authenticated users can read species requests"
  on public.species_requests for select
  to authenticated
  using (true);

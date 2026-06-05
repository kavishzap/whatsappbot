-- Run in Supabase SQL Editor so authenticated users can read their own profile.

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = id);

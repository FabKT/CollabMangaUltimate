create table if not exists public.sponsorship_reviews (
  id uuid primary key default gen_random_uuid(),
  sponsorship_id text not null references public.sponsorships(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (sponsorship_id, reviewer_id)
);

alter table public.sponsorship_reviews enable row level security;

drop policy if exists "sponsorship reviews are publicly readable" on public.sponsorship_reviews;
create policy "sponsorship reviews are publicly readable"
on public.sponsorship_reviews for select
using (true);

drop policy if exists "sponsorship participants create reviews" on public.sponsorship_reviews;
create policy "sponsorship participants create reviews"
on public.sponsorship_reviews for insert
to authenticated
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1 from public.sponsorships sponsorship
    where sponsorship.id = sponsorship_reviews.sponsorship_id
      and sponsorship.data->>'status' = 'finished'
      and public.can_access_sponsorship(sponsorship.id)
  )
);

-- Durable CollabManga AI library and generated-image history.
-- Binary image data lives in Storage; these tables only keep metadata and URLs.

create table if not exists public.ai_character_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint ai_character_profiles_profile_object
    check (jsonb_typeof(profile) = 'object')
);

create index if not exists ai_character_profiles_user_updated_idx
  on public.ai_character_profiles (user_id, updated_at desc);

alter table public.ai_character_profiles enable row level security;

drop policy if exists "ai_character_profiles_select_own" on public.ai_character_profiles;
create policy "ai_character_profiles_select_own"
on public.ai_character_profiles for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "ai_character_profiles_insert_own" on public.ai_character_profiles;
create policy "ai_character_profiles_insert_own"
on public.ai_character_profiles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "ai_character_profiles_update_own" on public.ai_character_profiles;
create policy "ai_character_profiles_update_own"
on public.ai_character_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "ai_character_profiles_delete_own" on public.ai_character_profiles;
create policy "ai_character_profiles_delete_own"
on public.ai_character_profiles for delete
to authenticated
using (user_id = auth.uid());

revoke all on table public.ai_character_profiles from public, anon;
grant select, insert, update, delete on table public.ai_character_profiles to authenticated;
grant all on table public.ai_character_profiles to service_role;

create table if not exists public.ai_generated_images (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.ai_generation_jobs(id) on delete set null,
  image_url text not null,
  prompt text not null default '',
  final_prompt text not null default '',
  task_type text not null default '',
  model text not null default '',
  size text not null default '',
  quality text not null default '',
  source text,
  title text,
  edit_context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_generated_images_edit_context_object
    check (edit_context is null or jsonb_typeof(edit_context) = 'object')
);

create unique index if not exists ai_generated_images_job_unique
  on public.ai_generated_images (job_id)
  where job_id is not null;

create index if not exists ai_generated_images_user_created_idx
  on public.ai_generated_images (user_id, created_at desc);

alter table public.ai_generated_images enable row level security;

drop policy if exists "ai_generated_images_select_own" on public.ai_generated_images;
create policy "ai_generated_images_select_own"
on public.ai_generated_images for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "ai_generated_images_insert_own" on public.ai_generated_images;
create policy "ai_generated_images_insert_own"
on public.ai_generated_images for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "ai_generated_images_update_own" on public.ai_generated_images;
create policy "ai_generated_images_update_own"
on public.ai_generated_images for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "ai_generated_images_delete_own" on public.ai_generated_images;
create policy "ai_generated_images_delete_own"
on public.ai_generated_images for delete
to authenticated
using (user_id = auth.uid());

revoke all on table public.ai_generated_images from public, anon;
grant select, insert, update, delete on table public.ai_generated_images to authenticated;
grant all on table public.ai_generated_images to service_role;

-- Existing user-owned media policies already constrain uploads to <auth.uid()>/...
-- Keep explicit AI policies for installations that do not have the original policy.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ai_media_insert_own'
  ) then
    create policy "ai_media_insert_own"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'media'
      and (storage.foldername(name))[1] = auth.uid()::text
      and (storage.foldername(name))[2] = 'ai'
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ai_media_update_own'
  ) then
    create policy "ai_media_update_own"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'media'
      and owner_id = auth.uid()::text
      and (storage.foldername(name))[2] = 'ai'
    )
    with check (
      bucket_id = 'media'
      and (storage.foldername(name))[1] = auth.uid()::text
      and (storage.foldername(name))[2] = 'ai'
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ai_media_delete_own'
  ) then
    create policy "ai_media_delete_own"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'media'
      and owner_id = auth.uid()::text
      and (storage.foldername(name))[2] = 'ai'
    );
  end if;
end
$$;

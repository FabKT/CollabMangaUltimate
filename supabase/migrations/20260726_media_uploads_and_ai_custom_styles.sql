-- Restore authenticated media writes for every user-owned feature.
-- All paths must start with the authenticated user's UUID.

drop policy if exists "media_auth_insert" on storage.objects;
create policy "media_auth_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media_owner_update" on storage.objects;
create policy "media_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media_owner_delete" on storage.objects;
create policy "media_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create table if not exists public.ai_custom_styles (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint ai_custom_styles_name_not_blank check (length(trim(name)) > 0),
  constraint ai_custom_styles_images_array check (jsonb_typeof(images) = 'array')
);

create index if not exists ai_custom_styles_user_created_idx
  on public.ai_custom_styles (user_id, created_at desc);

alter table public.ai_custom_styles enable row level security;

drop policy if exists "ai_custom_styles_select_own" on public.ai_custom_styles;
create policy "ai_custom_styles_select_own"
on public.ai_custom_styles for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "ai_custom_styles_insert_own" on public.ai_custom_styles;
create policy "ai_custom_styles_insert_own"
on public.ai_custom_styles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "ai_custom_styles_update_own" on public.ai_custom_styles;
create policy "ai_custom_styles_update_own"
on public.ai_custom_styles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "ai_custom_styles_delete_own" on public.ai_custom_styles;
create policy "ai_custom_styles_delete_own"
on public.ai_custom_styles for delete
to authenticated
using (user_id = auth.uid());

revoke all on table public.ai_custom_styles from public, anon;
grant select, insert, update, delete on table public.ai_custom_styles to authenticated;
grant all on table public.ai_custom_styles to service_role;

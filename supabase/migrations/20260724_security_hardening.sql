-- Distributed API rate limiting. Only the backend service role can consume it.
create table if not exists public.api_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default clock_timestamp(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.api_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  elapsed_seconds integer;
begin
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'INVALID_RATE_LIMIT_KEY';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT_CONFIGURATION';
  end if;

  insert into public.api_rate_limits (key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, v_now, 0, v_now)
  on conflict (key_hash) do nothing;

  select * into current_row
  from public.api_rate_limits
  where key_hash = p_key_hash
  for update;

  elapsed_seconds := greatest(
    0,
    floor(extract(epoch from (v_now - current_row.window_started_at)))::integer
  );

  if elapsed_seconds >= p_window_seconds then
    update public.api_rate_limits
    set window_started_at = v_now, request_count = 1, updated_at = v_now
    where key_hash = p_key_hash;
    return query select true, greatest(p_limit - 1, 0), 0;
  end if;

  if current_row.request_count >= p_limit then
    return query
      select false, 0, greatest(p_window_seconds - elapsed_seconds, 1);
    return;
  end if;

  update public.api_rate_limits
  set request_count = request_count + 1, updated_at = v_now
  where key_hash = p_key_hash;

  return query
    select true, greatest(p_limit - current_row.request_count - 1, 0), 0;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

-- Browser clients write directly to Supabase, so protect the main user-generated
-- resources at the database boundary as well as at the application API boundary.
create or replace function public.guard_authenticated_write_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  key_source text;
  key_hash text;
  result_row record;
begin
  -- Trusted backend jobs do not carry an authenticated end-user JWT.
  if actor_id is null then
    return new;
  end if;

  key_source := actor_id::text || ':' || tg_table_schema || '.' || tg_table_name || ':' || tg_op;
  key_hash := md5(key_source) || md5(reverse(key_source));

  select * into result_row
  from public.consume_api_rate_limit(
    key_hash,
    greatest(tg_argv[0]::integer, 1),
    greatest(tg_argv[1]::integer, 1)
  );

  if not result_row.allowed then
    raise exception 'RATE_LIMIT_EXCEEDED'
      using detail = 'Retry after ' || result_row.retry_after_seconds || ' seconds';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_authenticated_write_rate()
  from public, anon, authenticated;

do $$
declare
  target record;
  trigger_name text;
begin
  for target in
    select *
    from (
      values
        ('messages', 120, 60),
        ('shared_thread_messages', 120, 60),
        ('comments', 60, 60),
        ('notifications', 30, 60),
        ('workflow_records', 30, 60),
        ('announcement_interests', 60, 60),
        ('announcements', 20, 60),
        ('ideas', 20, 60),
        ('illustrations', 20, 60)
    ) as limits(table_name, request_limit, window_seconds)
  loop
    if to_regclass('public.' || target.table_name) is null then
      continue;
    end if;
    trigger_name := 'rate_limit_' || target.table_name || '_inserts';
    execute format('drop trigger if exists %I on public.%I', trigger_name, target.table_name);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.guard_authenticated_write_rate(%L, %L)',
      trigger_name,
      target.table_name,
      target.request_limit,
      target.window_seconds
    );
  end loop;
end
$$;

-- Mutation and lookup RPCs must never be callable by anonymous visitors.
revoke execute on function public.can_access_shared_thread(text, text) from public, anon;
revoke execute on function public.can_access_sponsorship(text) from public, anon;
revoke execute on function public.can_edit_studio_project(text) from public, anon;
revoke execute on function public.is_studio_project_owner(text) from public, anon;
revoke execute on function public.leave_studio_project(text) from public, anon;
revoke execute on function public.merge_studio_candidate_images(text, jsonb) from public, anon;
revoke execute on function public.remove_studio_project_member(text, uuid) from public, anon;
revoke execute on function public.resolve_profile_for_project_invitation(text) from public, anon;
revoke execute on function public.set_studio_project_member_level(text, uuid, text) from public, anon;
revoke execute on function public.transfer_studio_project_ownership(text, uuid) from public, anon;

grant execute on function public.can_access_shared_thread(text, text) to authenticated;
grant execute on function public.can_access_sponsorship(text) to authenticated;
grant execute on function public.can_edit_studio_project(text) to authenticated;
grant execute on function public.is_studio_project_owner(text) to authenticated;
grant execute on function public.leave_studio_project(text) to authenticated;
grant execute on function public.merge_studio_candidate_images(text, jsonb) to authenticated;
grant execute on function public.remove_studio_project_member(text, uuid) to authenticated;
grant execute on function public.resolve_profile_for_project_invitation(text) to authenticated;
grant execute on function public.set_studio_project_member_level(text, uuid, text) to authenticated;
grant execute on function public.transfer_studio_project_ownership(text, uuid) to authenticated;

-- Trigger functions are invoked by PostgreSQL and must not be callable as RPCs.
revoke all on function public.notify_new_comment() from public, anon, authenticated;
revoke all on function public.notify_new_message() from public, anon, authenticated;
revoke all on function public.notify_published_studio_chapters() from public, anon, authenticated;
revoke all on function public.notify_shared_thread_message() from public, anon, authenticated;
revoke all on function public.notify_sponsorship_review() from public, anon, authenticated;

alter function public.touch_studio_project_updated_at() set search_path = public;
alter function public.preserve_studio_project_owner() set search_path = public;

-- Only the recipient can accept or decline a workflow request.
drop policy if exists "wf_update_involved" on public.workflow_records;
drop policy if exists "wf_recipient_updates" on public.workflow_records;
create policy "wf_recipient_updates"
on public.workflow_records for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create or replace function public.protect_workflow_record_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'status' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'WORKFLOW_IDENTITY_IS_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_workflow_record_identity on public.workflow_records;
create trigger protect_workflow_record_identity
before update on public.workflow_records
for each row execute function public.protect_workflow_record_identity();

create or replace function public.validate_workflow_initial_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind in (
    'friend_request',
    'collaboration_invitation',
    'proposal',
    'patronage_request',
    'announcement_sponsoring',
    'sponsorship_contact'
  ) and new.status <> 'pending' then
    raise exception 'WORKFLOW_REQUEST_MUST_START_PENDING';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_workflow_initial_status on public.workflow_records;
create trigger validate_workflow_initial_status
before insert on public.workflow_records
for each row execute function public.validate_workflow_initial_status();

-- Public media remain readable, but uploads are limited to expected image formats.
update storage.buckets
set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif'
  ]::text[]
where id = 'media';

-- Public object URLs do not require a SELECT policy. Removing this broad policy
-- prevents clients from enumerating every uploaded file in the bucket.
drop policy if exists "media_public_read" on storage.objects;

-- Only the four public CollabManga roles are valid profile roles.
update public.profiles
set role = case role
  when 'Artist' then 'Dessinateur'
  when 'Writer' then 'Scénariste'
  when 'Content creator' then 'Créateur de contenu'
  when 'Reader' then 'Lecteur'
  else role
end;

update public.profiles
set secondary_role = case secondary_role
  when 'Artist' then 'Dessinateur'
  when 'Writer' then 'Scénariste'
  when 'Content creator' then 'Créateur de contenu'
  when 'Reader' then 'Lecteur'
  else secondary_role
end;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_secondary_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or role in ('Dessinateur', 'Scénariste', 'Créateur de contenu', 'Lecteur')
  );

alter table public.profiles
  add constraint profiles_secondary_role_check
  check (
    secondary_role is null
    or secondary_role in ('Dessinateur', 'Scénariste', 'Créateur de contenu', 'Lecteur')
  );

create table if not exists public.studio_projects (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  synopsis text not null default '',
  status text not null default 'Draft',
  catalog_visible boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_project_members (
  project_id text not null references public.studio_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null default 'collaborateur'
    check (access_level in ('chef', 'editeur', 'collaborateur')),
  role text,
  status text not null default 'active'
    check (status in ('invited', 'active', 'declined')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists studio_projects_owner_idx
  on public.studio_projects (owner_id, updated_at desc);
create index if not exists studio_projects_catalog_idx
  on public.studio_projects (catalog_visible, updated_at desc);
create index if not exists studio_project_members_user_idx
  on public.studio_project_members (user_id, status);

create or replace function public.is_studio_project_owner(target_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.studio_projects
    where id = target_project_id and owner_id = auth.uid()
  );
$$;

create or replace function public.is_studio_project_member(target_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.studio_project_members
    where project_id = target_project_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.can_edit_studio_project(target_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_studio_project_owner(target_project_id)
    or exists (
      select 1 from public.studio_project_members
      where project_id = target_project_id
        and user_id = auth.uid()
        and status = 'active'
        and access_level in ('chef', 'editeur')
    );
$$;

revoke all on function public.is_studio_project_owner(text) from public;
revoke all on function public.is_studio_project_member(text) from public;
revoke all on function public.can_edit_studio_project(text) from public;
grant execute on function public.is_studio_project_owner(text) to anon, authenticated;
grant execute on function public.is_studio_project_member(text) to anon, authenticated;
grant execute on function public.can_edit_studio_project(text) to anon, authenticated;

create or replace function public.resolve_profile_for_project_invitation(identifier text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  role text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.role
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(leading '@' from trim(identifier)))
     or lower(coalesce(u.email, '')) = lower(trim(identifier))
  limit 1;
$$;

revoke all on function public.resolve_profile_for_project_invitation(text) from public;
grant execute on function public.resolve_profile_for_project_invitation(text) to authenticated;

alter table public.studio_projects enable row level security;
alter table public.studio_project_members enable row level security;

drop policy if exists "studio projects are readable by their audience" on public.studio_projects;
create policy "studio projects are readable by their audience"
on public.studio_projects for select
using (
  catalog_visible
  or owner_id = auth.uid()
  or public.is_studio_project_member(id)
);

drop policy if exists "users create their own studio projects" on public.studio_projects;
create policy "users create their own studio projects"
on public.studio_projects for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "project editors update studio projects" on public.studio_projects;
create policy "project editors update studio projects"
on public.studio_projects for update
to authenticated
using (public.can_edit_studio_project(id))
with check (public.can_edit_studio_project(id));

drop policy if exists "project owners delete studio projects" on public.studio_projects;
create policy "project owners delete studio projects"
on public.studio_projects for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "project members are readable by participants" on public.studio_project_members;
create policy "project members are readable by participants"
on public.studio_project_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_studio_project_owner(project_id)
  or public.is_studio_project_member(project_id)
);

drop policy if exists "project owners invite members" on public.studio_project_members;
create policy "project owners invite members"
on public.studio_project_members for insert
to authenticated
with check (
  public.is_studio_project_owner(project_id)
  or (user_id = auth.uid() and public.is_studio_project_owner(project_id))
);

drop policy if exists "members or owners update memberships" on public.studio_project_members;
create policy "members or owners update memberships"
on public.studio_project_members for update
to authenticated
using (user_id = auth.uid() or public.is_studio_project_owner(project_id))
with check (user_id = auth.uid() or public.is_studio_project_owner(project_id));

drop policy if exists "members leave or owners remove memberships" on public.studio_project_members;
create policy "members leave or owners remove memberships"
on public.studio_project_members for delete
to authenticated
using (user_id = auth.uid() or public.is_studio_project_owner(project_id));

create or replace function public.touch_studio_project_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.preserve_studio_project_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id <> old.owner_id
    and coalesce(current_setting('app.allow_studio_owner_transfer', true), '') <> 'on'
  then
    new.owner_id = old.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists studio_projects_preserve_owner on public.studio_projects;
create trigger studio_projects_preserve_owner
before update on public.studio_projects
for each row execute function public.preserve_studio_project_owner();

drop trigger if exists studio_projects_touch_updated_at on public.studio_projects;
create trigger studio_projects_touch_updated_at
before update on public.studio_projects
for each row execute function public.touch_studio_project_updated_at();

drop trigger if exists studio_project_members_touch_updated_at on public.studio_project_members;
create trigger studio_project_members_touch_updated_at
before update on public.studio_project_members
for each row execute function public.touch_studio_project_updated_at();

create or replace function public.leave_studio_project(target_project_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  replacement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.is_studio_project_owner(target_project_id) then
    select user_id into replacement_id
    from public.studio_project_members
    where project_id = target_project_id
      and user_id <> auth.uid()
      and status = 'active'
    order by
      case access_level when 'chef' then 0 when 'editeur' then 1 else 2 end,
      created_at
    limit 1;

    if replacement_id is null then
      raise exception 'Le propriétaire ne peut pas quitter un projet sans autre membre actif.';
    end if;

    perform set_config('app.allow_studio_owner_transfer', 'on', true);
    update public.studio_projects set owner_id = replacement_id where id = target_project_id;
    update public.studio_project_members
      set access_level = case when user_id = replacement_id then 'chef' else access_level end
      where project_id = target_project_id;
  end if;

  delete from public.studio_project_members
  where project_id = target_project_id and user_id = auth.uid();
end;
$$;

revoke all on function public.leave_studio_project(text) from public;
grant execute on function public.leave_studio_project(text) to authenticated;

create or replace function public.transfer_studio_project_ownership(
  target_project_id text,
  new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_studio_project_owner(target_project_id) then
    raise exception 'Seul le propriétaire peut transférer le projet.';
  end if;
  if not exists (
    select 1 from public.studio_project_members
    where project_id = target_project_id
      and user_id = new_owner_id
      and status = 'active'
  ) then
    raise exception 'Le nouveau propriétaire doit être un membre actif.';
  end if;

  update public.studio_project_members
  set access_level = case
    when user_id = new_owner_id then 'chef'
    when user_id = auth.uid() then 'editeur'
    else access_level
  end
  where project_id = target_project_id;
  perform set_config('app.allow_studio_owner_transfer', 'on', true);
  update public.studio_projects set owner_id = new_owner_id where id = target_project_id;
end;
$$;

revoke all on function public.transfer_studio_project_ownership(text, uuid) from public;
grant execute on function public.transfer_studio_project_ownership(text, uuid) to authenticated;

create table if not exists public.profile_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profile_preferences enable row level security;

drop policy if exists "profile preferences are publicly readable" on public.profile_preferences;
create policy "profile preferences are publicly readable"
on public.profile_preferences for select
using (true);

drop policy if exists "users insert their profile preferences" on public.profile_preferences;
create policy "users insert their profile preferences"
on public.profile_preferences for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users update their profile preferences" on public.profile_preferences;
create policy "users update their profile preferences"
on public.profile_preferences for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists public.manga_chapter_ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  manga_id text not null,
  chapter_id text not null,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, manga_id, chapter_id)
);

create index if not exists manga_chapter_ratings_manga_idx
  on public.manga_chapter_ratings (manga_id);

alter table public.manga_chapter_ratings enable row level security;

drop policy if exists "manga ratings are publicly readable" on public.manga_chapter_ratings;
create policy "manga ratings are publicly readable"
on public.manga_chapter_ratings for select
using (true);

drop policy if exists "users insert their manga ratings" on public.manga_chapter_ratings;
create policy "users insert their manga ratings"
on public.manga_chapter_ratings for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users update their manga ratings" on public.manga_chapter_ratings;
create policy "users update their manga ratings"
on public.manga_chapter_ratings for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_favorites_user_idx
  on public.user_favorites (user_id, created_at desc);

alter table public.user_favorites enable row level security;

drop policy if exists "users read their favorites" on public.user_favorites;
create policy "users read their favorites"
on public.user_favorites for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users insert their favorites" on public.user_favorites;
create policy "users insert their favorites"
on public.user_favorites for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users delete their favorites" on public.user_favorites;
create policy "users delete their favorites"
on public.user_favorites for delete
to authenticated
using (user_id = auth.uid());

create table if not exists public.sponsor_options (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('creator', 'project')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsor_options_owner_idx
  on public.sponsor_options (owner_id, created_at desc);

alter table public.sponsor_options enable row level security;

drop policy if exists "sponsor options are publicly readable" on public.sponsor_options;
create policy "sponsor options are publicly readable"
on public.sponsor_options for select
using (true);

drop policy if exists "users insert their sponsor options" on public.sponsor_options;
create policy "users insert their sponsor options"
on public.sponsor_options for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "users update their sponsor options" on public.sponsor_options;
create policy "users update their sponsor options"
on public.sponsor_options for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "users delete their sponsor options" on public.sponsor_options;
create policy "users delete their sponsor options"
on public.sponsor_options for delete
to authenticated
using (owner_id = auth.uid());

create table if not exists public.announcement_interests (
  announcement_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcement_interests enable row level security;

drop policy if exists "announcement interests are readable" on public.announcement_interests;
create policy "announcement interests are readable"
on public.announcement_interests for select
to authenticated
using (true);

drop policy if exists "users express their own interest" on public.announcement_interests;
create policy "users express their own interest"
on public.announcement_interests for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users remove their own interest" on public.announcement_interests;
create policy "users remove their own interest"
on public.announcement_interests for delete
to authenticated
using (user_id = auth.uid());

create table if not exists public.sponsorships (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid references public.profiles(id) on delete set null,
  project_id text references public.studio_projects(id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsorships_owner_idx on public.sponsorships (owner_id, created_at desc);
create index if not exists sponsorships_creator_idx on public.sponsorships (creator_id, created_at desc);
alter table public.sponsorships enable row level security;

create or replace function public.can_access_sponsorship(target_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sponsorships s
    where s.id = target_id
      and (
        s.owner_id = auth.uid()
        or s.creator_id = auth.uid()
        or (s.project_id is not null and public.is_studio_project_member(s.project_id))
      )
  );
$$;

revoke all on function public.can_access_sponsorship(text) from public;
grant execute on function public.can_access_sponsorship(text) to authenticated;

drop policy if exists "sponsorship parties can read" on public.sponsorships;
create policy "sponsorship parties can read"
on public.sponsorships for select
to authenticated
using (
  owner_id = auth.uid()
  or creator_id = auth.uid()
  or (project_id is not null and public.is_studio_project_member(project_id))
);

drop policy if exists "users create sponsorships" on public.sponsorships;
create policy "users create sponsorships"
on public.sponsorships for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "sponsorship parties update" on public.sponsorships;
create policy "sponsorship parties update"
on public.sponsorships for update
to authenticated
using (public.can_access_sponsorship(id))
with check (public.can_access_sponsorship(id));

drop policy if exists "sponsorship owners delete" on public.sponsorships;
create policy "sponsorship owners delete"
on public.sponsorships for delete
to authenticated
using (owner_id = auth.uid());

create table if not exists public.shared_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_kind text not null check (thread_kind in ('project', 'sponsorship')),
  thread_id text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists shared_thread_messages_thread_idx
  on public.shared_thread_messages (thread_kind, thread_id, created_at);
alter table public.shared_thread_messages enable row level security;

create or replace function public.can_access_shared_thread(kind text, target_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when kind = 'project' then public.is_studio_project_member(target_id)
    when kind = 'sponsorship' then public.can_access_sponsorship(target_id)
    else false
  end;
$$;

revoke all on function public.can_access_shared_thread(text, text) from public;
grant execute on function public.can_access_shared_thread(text, text) to authenticated;

drop policy if exists "thread members can read" on public.shared_thread_messages;
create policy "thread members can read"
on public.shared_thread_messages for select
to authenticated
using (public.can_access_shared_thread(thread_kind, thread_id));

drop policy if exists "thread members can send" on public.shared_thread_messages;
create policy "thread members can send"
on public.shared_thread_messages for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.can_access_shared_thread(thread_kind, thread_id)
);

alter table public.illustrations
  add column if not exists image_urls text[] not null default '{}'::text[];

alter table public.ideas
  add column if not exists image_urls text[] not null default '{}'::text[];

alter table public.announcements
  add column if not exists remuneration boolean not null default false,
  add column if not exists engagement text not null default 'Long terme';

update public.illustrations
set image_urls = array[image_url]
where cardinality(image_urls) = 0 and image_url is not null;

update public.ideas
set image_urls = array[image_url]
where cardinality(image_urls) = 0 and image_url is not null;

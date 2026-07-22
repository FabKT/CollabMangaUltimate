create or replace function public.set_studio_project_member_level(
  target_project_id text,
  target_user_id uuid,
  next_access_level text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_level text;
  target_level text;
begin
  if next_access_level not in ('editeur', 'collaborateur') then
    raise exception 'Invalid access level';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Use the leave-project action for your own membership';
  end if;
  if public.is_studio_project_owner(target_project_id) then
    actor_level := 'chef';
  else
    select access_level into actor_level
    from public.studio_project_members
    where project_id = target_project_id and user_id = auth.uid() and status = 'active';
  end if;
  select access_level into target_level
  from public.studio_project_members
  where project_id = target_project_id and user_id = target_user_id and status = 'active';
  if target_level is null then raise exception 'Project member not found'; end if;
  if actor_level = 'chef' then
    update public.studio_project_members
    set access_level = next_access_level
    where project_id = target_project_id and user_id = target_user_id;
  elsif actor_level = 'editeur' and target_level = 'collaborateur' and next_access_level = 'editeur' then
    update public.studio_project_members
    set access_level = 'editeur'
    where project_id = target_project_id and user_id = target_user_id;
  else
    raise exception 'Insufficient project permissions';
  end if;
end;
$$;

create or replace function public.remove_studio_project_member(
  target_project_id text,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_level text;
  target_level text;
begin
  if target_user_id = auth.uid() then
    raise exception 'Use the leave-project action for your own membership';
  end if;
  if public.is_studio_project_owner(target_project_id) then
    actor_level := 'chef';
  else
    select access_level into actor_level
    from public.studio_project_members
    where project_id = target_project_id and user_id = auth.uid() and status = 'active';
  end if;
  select access_level into target_level
  from public.studio_project_members
  where project_id = target_project_id and user_id = target_user_id and status = 'active';
  if target_level is null then raise exception 'Project member not found'; end if;
  if actor_level = 'chef' or (actor_level = 'editeur' and target_level = 'collaborateur') then
    delete from public.studio_project_members
    where project_id = target_project_id and user_id = target_user_id;
  else
    raise exception 'Insufficient project permissions';
  end if;
end;
$$;

revoke all on function public.set_studio_project_member_level(text, uuid, text) from public;
revoke all on function public.remove_studio_project_member(text, uuid) from public;
grant execute on function public.set_studio_project_member_level(text, uuid, text) to authenticated;
grant execute on function public.remove_studio_project_member(text, uuid) to authenticated;

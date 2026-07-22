create or replace function public.notify_published_studio_chapters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chapter jsonb;
  previous_status text;
begin
  for chapter in
    select value from jsonb_array_elements(coalesce(new.data->'chapters', '[]'::jsonb))
  loop
    if chapter->>'status' <> 'Published' then
      continue;
    end if;

    select old_chapter->>'status' into previous_status
    from jsonb_array_elements(coalesce(old.data->'chapters', '[]'::jsonb)) old_chapter
    where old_chapter->>'id' = chapter->>'id'
    limit 1;

    if coalesce(previous_status, '') = 'Published' then
      continue;
    end if;

    insert into public.notifications (
      recipient_id,
      actor_id,
      category,
      type,
      title,
      content,
      entity_type,
      entity_title,
      entity_subtitle,
      entity_status
    )
    select
      workflow.initiator_id,
      auth.uid(),
      'manga',
      'nouveau_chapitre',
      'Nouveau chapitre de ' || new.title,
      coalesce(chapter->>'objective', 'Un nouveau chapitre vient d''être publié.'),
      'chapter',
      new.title,
      coalesce(chapter->>'title', 'Nouveau chapitre'),
      'Publié'
    from public.workflow_records workflow
    where workflow.kind = 'subscription'
      and workflow.status = 'active'
      and workflow.recipient_id = new.owner_id
      and workflow.initiator_id <> auth.uid();
  end loop;

  return new;
end;
$$;

drop trigger if exists studio_projects_notify_published_chapter on public.studio_projects;
create trigger studio_projects_notify_published_chapter
after update of data on public.studio_projects
for each row execute function public.notify_published_studio_chapters();

do $$
begin
  alter publication supabase_realtime add table public.studio_projects;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.studio_project_members;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.sponsorships;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.sponsor_options;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.illustrations;
exception when duplicate_object then null;
end
$$;

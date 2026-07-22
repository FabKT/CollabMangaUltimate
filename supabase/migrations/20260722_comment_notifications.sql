create or replace function public.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  entity_name text;
  actor_name text;
  label text;
  project_key text;
  chapter_key text;
  project_payload jsonb;
begin
  case new.entity_type
    when 'illustration' then
      select author_id, title into recipient, entity_name
      from public.illustrations where id::text = new.entity_id limit 1;
      label := 'illustration';
    when 'idea' then
      select author_id, title into recipient, entity_name
      from public.ideas where id::text = new.entity_id limit 1;
      label := 'idée';
    when 'announcement' then
      select author_id, title into recipient, entity_name
      from public.announcements where id::text = new.entity_id limit 1;
      label := 'annonce';
    when 'sponsor_option' then
      select owner_id, coalesce(data->>'format', data->>'title', 'Parrainage')
      into recipient, entity_name
      from public.sponsor_options where id = new.entity_id limit 1;
      label := 'annonce de parrainage';
    when 'manga_chapter' then
      project_key := split_part(new.entity_id, ':', 1);
      chapter_key := split_part(new.entity_id, ':', 2);
      select owner_id, title, data into recipient, entity_name, project_payload
      from public.studio_projects where id = project_key limit 1;
      entity_name := concat_ws(
        ' · ',
        entity_name,
        coalesce(
          (select chapter->>'title'
           from jsonb_array_elements(coalesce(project_payload->'chapters', '[]'::jsonb)) chapter
           where chapter->>'id' = chapter_key
           limit 1),
          'Chapitre'
        )
      );
      label := 'chapitre';
    else
      return new;
  end case;

  if recipient is null or recipient = new.author_id then
    return new;
  end if;

  select coalesce(display_name, username, 'Un membre') into actor_name
  from public.profiles where id = new.author_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    category,
    type,
    title,
    content,
    entity_type,
    entity_title
  ) values (
    recipient,
    new.author_id,
    case
      when new.entity_type = 'manga_chapter' then 'manga'
      when new.entity_type = 'sponsor_option' then 'sponsorship'
      else 'system'
    end,
    'nouveau_commentaire',
    coalesce(actor_name, 'Un membre') || ' a commenté ton ' || label,
    left(new.content, 180),
    new.entity_type,
    coalesce(entity_name, 'Publication')
  );

  return new;
end;
$$;

drop trigger if exists comments_notify_insert on public.comments;
create trigger comments_notify_insert
after insert on public.comments
for each row execute function public.notify_new_comment();

do $$
begin
  alter publication supabase_realtime add table public.comments;
exception
  when duplicate_object then null;
end
$$;

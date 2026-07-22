create or replace function public.notify_shared_thread_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  thread_title text;
begin
  select coalesce(nullif(p.display_name, ''), p.username, 'Un membre')
  into sender_name
  from public.profiles p
  where p.id = new.author_id;

  if new.thread_kind = 'project' then
    select coalesce(nullif(sp.title, ''), 'Projet')
    into thread_title
    from public.studio_projects sp
    where sp.id = new.thread_id;

    insert into public.notifications (
      recipient_id, actor_id, category, type, title, content,
      entity_type, entity_title, entity_status
    )
    select distinct
      m.user_id, new.author_id, 'message', 'message_projet',
      sender_name || ' a ecrit dans ' || coalesce(thread_title, 'un projet'),
      left(new.content, 180), 'project', coalesce(thread_title, 'Projet'), 'Nouveau'
    from public.studio_project_members m
    where m.project_id = new.thread_id
      and m.status = 'active'
      and m.user_id <> new.author_id;
  elsif new.thread_kind = 'sponsorship' then
    select coalesce(nullif(s.data->>'name', ''), 'Parrainage')
    into thread_title
    from public.sponsorships s
    where s.id = new.thread_id;

    insert into public.notifications (
      recipient_id, actor_id, category, type, title, content,
      entity_type, entity_title, entity_status
    )
    select distinct
      recipient_id, new.author_id, 'message', 'message_parrainage',
      sender_name || ' a ecrit dans ' || coalesce(thread_title, 'un parrainage'),
      left(new.content, 180), 'sponsorship', coalesce(thread_title, 'Parrainage'), 'Nouveau'
    from (
      select s.owner_id as recipient_id
      from public.sponsorships s where s.id = new.thread_id
      union
      select s.creator_id
      from public.sponsorships s where s.id = new.thread_id and s.creator_id is not null
      union
      select m.user_id
      from public.sponsorships s
      join public.studio_project_members m on m.project_id = s.project_id
      where s.id = new.thread_id and m.status = 'active'
    ) recipients
    where recipient_id <> new.author_id;
  end if;

  return new;
end;
$$;

drop trigger if exists shared_thread_messages_notify_recipients on public.shared_thread_messages;
create trigger shared_thread_messages_notify_recipients
after insert on public.shared_thread_messages
for each row execute function public.notify_shared_thread_message();

drop policy if exists "sponsorship participants create reviews" on public.sponsorship_reviews;
create policy "sponsorship participants create reviews"
on public.sponsorship_reviews for insert
to authenticated
with check (
  reviewer_id = auth.uid()
  and reviewer_id <> creator_id
  and exists (
    select 1 from public.sponsorships sponsorship
    where sponsorship.id = sponsorship_reviews.sponsorship_id
      and sponsorship.creator_id = sponsorship_reviews.creator_id
      and sponsorship.data->>'status' = 'finished'
      and public.can_access_sponsorship(sponsorship.id)
  )
);

create or replace function public.notify_sponsorship_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer_name text;
  sponsorship_name text;
begin
  select coalesce(nullif(p.display_name, ''), p.username, 'Un membre')
  into reviewer_name
  from public.profiles p where p.id = new.reviewer_id;

  select coalesce(nullif(s.data->>'name', ''), 'Parrainage')
  into sponsorship_name
  from public.sponsorships s where s.id = new.sponsorship_id;

  insert into public.notifications (
    recipient_id, actor_id, category, type, title, content,
    entity_type, entity_title, entity_status
  ) values (
    new.creator_id, new.reviewer_id, 'sponsorship', 'avis_parrainage',
    reviewer_name || ' a publie un avis', left(new.comment, 180),
    'sponsorship', coalesce(sponsorship_name, 'Parrainage'), new.rating || '/5'
  );
  return new;
end;
$$;

drop trigger if exists sponsorship_reviews_notify_creator on public.sponsorship_reviews;
create trigger sponsorship_reviews_notify_creator
after insert on public.sponsorship_reviews
for each row execute function public.notify_sponsorship_review();

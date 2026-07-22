create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select coalesce(nullif(profile.display_name, ''), profile.username, 'Un membre')
  into sender_name
  from public.profiles profile
  where profile.id = new.sender_id;

  insert into public.notifications (
    recipient_id, actor_id, category, type, title, content, entity_type, entity_title
  )
  select
    member.profile_id,
    new.sender_id,
    'message',
    'nouveau_message',
    sender_name || ' t''a envoyé un message',
    left(coalesce(nullif(new.content, ''), 'Image envoyée'), 180),
    'conversation',
    sender_name
  from public.conversation_members member
  where member.conversation_id = new.conversation_id
    and member.profile_id <> new.sender_id;

  return new;
end;
$$;

drop trigger if exists messages_notify_recipients on public.messages;
create trigger messages_notify_recipients
after insert on public.messages
for each row execute function public.notify_new_message();

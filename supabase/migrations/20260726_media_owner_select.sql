-- Authenticated users may inspect only their own media objects.
-- Storage upsert/existence checks require SELECT without exposing other users' files.

drop policy if exists "media_owner_select" on storage.objects;
create policy "media_owner_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

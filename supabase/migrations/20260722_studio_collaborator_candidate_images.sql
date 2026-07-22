create or replace function public.merge_studio_candidate_images(
  target_project_id text,
  incoming_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_data jsonb;
  incoming_chapter jsonb;
  incoming_page jsonb;
  incoming_candidate jsonb;
  chapter_index integer;
  page_index integer;
  candidate_index integer;
  current_candidates jsonb;
  current_candidate jsonb;
  incoming_image text;
begin
  if not exists (
    select 1
    from public.studio_project_members
    where project_id = target_project_id
      and user_id = auth.uid()
      and status = 'active'
      and access_level = 'collaborateur'
  ) then
    raise exception 'Only an active project collaborator can add candidate images';
  end if;

  select data into current_data
  from public.studio_projects
  where id = target_project_id
  for update;

  if current_data is null then
    raise exception 'Project not found';
  end if;

  for incoming_chapter in select value from jsonb_array_elements(coalesce(incoming_data->'chapters', '[]'::jsonb))
  loop
    select ordinality - 1 into chapter_index
    from jsonb_array_elements(coalesce(current_data->'chapters', '[]'::jsonb)) with ordinality chapter
    where chapter.value->>'id' = incoming_chapter->>'id'
    limit 1;
    if chapter_index is null then continue; end if;

    for incoming_page in select value from jsonb_array_elements(coalesce(incoming_chapter->'pages', '[]'::jsonb))
    loop
      select ordinality - 1 into page_index
      from jsonb_array_elements(coalesce(current_data #> array['chapters', chapter_index::text, 'pages'], '[]'::jsonb)) with ordinality page
      where page.value->>'id' = incoming_page->>'id'
      limit 1;
      if page_index is null then continue; end if;

      current_candidates := coalesce(
        current_data #> array['chapters', chapter_index::text, 'pages', page_index::text, 'candidates'],
        '[]'::jsonb
      );
      for incoming_candidate in select value from jsonb_array_elements(coalesce(incoming_page->'candidates', '[]'::jsonb))
      loop
        incoming_image := incoming_candidate->>'image';
        if incoming_image is null or incoming_image = '' then continue; end if;

        select ordinality - 1, candidate.value into candidate_index, current_candidate
        from jsonb_array_elements(current_candidates) with ordinality candidate
        where candidate.value->>'id' = incoming_candidate->>'id'
        limit 1;

        if candidate_index is null then
          current_candidates := current_candidates || jsonb_build_array(
            jsonb_build_object(
              'id', incoming_candidate->>'id',
              'image', incoming_image,
              'status', 'Imported'
            )
          );
        elsif coalesce(current_candidate->>'image', '') = '' then
          current_candidates := jsonb_set(
            current_candidates,
            array[candidate_index::text],
            current_candidate || jsonb_build_object('image', incoming_image, 'status', 'Imported')
          );
        end if;
        candidate_index := null;
        current_candidate := null;
      end loop;

      current_data := jsonb_set(
        current_data,
        array['chapters', chapter_index::text, 'pages', page_index::text, 'candidates'],
        current_candidates
      );
      page_index := null;
    end loop;
    chapter_index := null;
  end loop;

  update public.studio_projects
  set data = current_data, updated_at = now()
  where id = target_project_id;
end;
$$;

revoke all on function public.merge_studio_candidate_images(text, jsonb) from public;
grant execute on function public.merge_studio_candidate_images(text, jsonb) to authenticated;

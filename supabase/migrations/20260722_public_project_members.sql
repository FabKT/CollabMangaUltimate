drop policy if exists "published project members are publicly readable"
on public.studio_project_members;

create policy "published project members are publicly readable"
on public.studio_project_members for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.studio_projects project
    where project.id = studio_project_members.project_id
      and project.catalog_visible = true
  )
);

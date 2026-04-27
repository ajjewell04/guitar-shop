-- ============================================================
-- asset_files policies
-- ============================================================

-- Files whose parent asset is approved are visible to everyone (incl. guests)
create policy "Anyone can view files for approved assets"
  on public.asset_files
  as permissive
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.assets a
      where a.id = asset_files.asset_id
        and a.upload_status = 'approved'
    )
  );

-- Owners see all their own files (any status, incl. project previews where asset_id is null)
create policy "Owners can view their own asset files"
  on public.asset_files
  as permissive
  for select
  to authenticated
  using (owner_id = auth.uid());

-- Owners can insert files they own; the linked asset (if any) must also belong to them
create policy "Users can insert asset_files"
  on public.asset_files
  as permissive
  for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and (
      asset_id is null
      or exists (
        select 1
        from public.assets a
        where a.id = asset_id and a.owner_id = auth.uid()
      )
    )
  );

-- Mirror the INSERT asset-ownership check: the linked asset (if any) must belong
-- to the owner, preventing a file from being re-pointed at another user's asset.
create policy "Users can update their asset_files"
  on public.asset_files
  as permissive
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      asset_id is null
      or exists (
        select 1 from public.assets a
        where a.id = asset_id and a.owner_id = auth.uid()
      )
    )
  );

create policy "Users can delete asset files they own"
  on public.asset_files
  as permissive
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- assets policies
-- ============================================================

-- Approved assets are visible to everyone, including guests
create policy "Anyone can view approved assets"
  on public.assets
  as permissive
  for select
  to anon, authenticated
  using (upload_status = 'approved');

-- Owners see all their own assets regardless of status
create policy "Owners can view their own assets"
  on public.assets
  as permissive
  for select
  to authenticated
  using (owner_id = auth.uid());

-- Only the review system (service_role) may set upload_status = 'approved';
-- owners may insert/update any other status.
create policy "Users can insert assets"
  on public.assets
  as permissive
  for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and upload_status is distinct from 'approved'
  );

create policy "Users can update their assets"
  on public.assets
  as permissive
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and upload_status is distinct from 'approved'
  );

create policy "Users can delete their assets"
  on public.assets
  as permissive
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- project_nodes policies
-- ============================================================

create policy "Project owners can select project nodes"
  on public.project_nodes
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_nodes.project_id
        and p.owner_id = auth.uid()
    )
  );

-- Asset must be either publicly approved (community library) or owned by the
-- caller; pending assets from other users cannot be embedded in a project.
create policy "Project owners can insert project nodes"
  on public.project_nodes
  as permissive
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_nodes.project_id
        and p.owner_id = auth.uid()
    )
    and (
      asset_id is null
      or exists (
        select 1 from public.assets a
        where a.id = asset_id
          and (a.upload_status = 'approved' or a.owner_id = auth.uid())
      )
    )
  );

create policy "Users can edit and save their project"
  on public.project_nodes
  as permissive
  for update
  to authenticated
  using (
    (select projects.owner_id from public.projects where projects.id = project_nodes.project_id)
    = auth.uid()
  )
  with check (
    (select projects.owner_id from public.projects where projects.id = project_nodes.project_id)
    = auth.uid()
    and (
      asset_id is null
      or exists (
        select 1 from public.assets a
        where a.id = asset_id
          and (a.upload_status = 'approved' or a.owner_id = auth.uid())
      )
    )
  );

create policy "Project owners can delete project nodes"
  on public.project_nodes
  as permissive
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_nodes.project_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- projects policies
-- ============================================================

-- Projects are strictly private; only the owner can read them
create policy "Owners can view their own projects"
  on public.projects
  as permissive
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "Authenticated users can create new projects"
  on public.projects
  as permissive
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Users can update their projects"
  on public.projects
  as permissive
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Users can delete their projects"
  on public.projects
  as permissive
  for delete
  to authenticated
  using (owner_id = auth.uid());

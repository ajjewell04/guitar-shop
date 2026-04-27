-- asset_files policies

create policy "Asset file preview backfill"
  on "public"."asset_files"
  as permissive
  for insert
  to authenticated
  with check (((file_variant = 'preview'::public.file_variant) AND (EXISTS ( SELECT 1
   FROM public.assets a
  WHERE ((a.id = asset_files.asset_id) AND (a.upload_status = 'approved'::public.upload_status) AND (a.owner_id = asset_files.owner_id) AND (a.preview_file_id IS NULL))))));

create policy "Users can access approved files"
  on "public"."asset_files"
  as permissive
  for select
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM public.assets a
  WHERE (a.id = asset_files.asset_id))));

create policy "Users can delete asset files they own"
  on "public"."asset_files"
  as permissive
  for delete
  to authenticated
  using ((( SELECT auth.uid() AS uid) = owner_id));

create policy "Users can insert asset_files"
  on "public"."asset_files"
  as permissive
  for insert
  to authenticated
  with check ((owner_id = auth.uid()));

create policy "Users can insert previews for their projects"
  on "public"."asset_files"
  as permissive
  for select
  to public
  using (((owner_id = auth.uid()) AND (file_variant = 'preview'::public.file_variant) AND (asset_id IS NULL)));

create policy "Users can update their asset_files"
  on "public"."asset_files"
  as permissive
  for update
  to authenticated
  using ((owner_id = auth.uid()));

-- assets policies

create policy "Users can access assets if they are uploaded"
  on "public"."assets"
  as permissive
  for select
  to authenticated
  using (((upload_status)::text = 'approved'::text));

create policy "Users can access their assets"
  on "public"."assets"
  as permissive
  for select
  to public
  using (( SELECT (auth.uid() = assets.owner_id)));

create policy "Users can delete their assets"
  on "public"."assets"
  as permissive
  for delete
  to authenticated
  using ((( SELECT auth.uid() AS uid) = owner_id));

create policy "Users can fulfull preview generation"
  on "public"."assets"
  as permissive
  for update
  to authenticated
  using (((upload_status = 'approved'::public.upload_status) AND (preview_file_id IS NULL)))
  with check ((upload_status = 'approved'::public.upload_status));

create policy "Users can insert assets"
  on "public"."assets"
  as permissive
  for insert
  to authenticated
  with check ((owner_id = auth.uid()));

create policy "Users can update their assets"
  on "public"."assets"
  as permissive
  for update
  to authenticated
  using ((owner_id = ( SELECT auth.uid() AS uid)))
  with check ((owner_id = ( SELECT auth.uid() AS uid)));

-- project_nodes policies

create policy "Project owners can insert project nodes"
  on "public"."project_nodes"
  as permissive
  for insert
  to authenticated
  with check ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_nodes.project_id) AND (p.owner_id = auth.uid())))));

create policy "Project owners can select project nodes"
  on "public"."project_nodes"
  as permissive
  for select
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_nodes.project_id) AND (p.owner_id = auth.uid())))));

create policy "Users can delete project nodes from a project"
  on "public"."project_nodes"
  as permissive
  for delete
  to public
  using ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_nodes.project_id) AND (p.owner_id = auth.uid())))));

create policy "Users can edit and save their project"
  on "public"."project_nodes"
  as permissive
  for update
  to authenticated
  using ((( SELECT projects.owner_id
   FROM public.projects
  WHERE (projects.id = project_nodes.project_id)) = ( SELECT auth.uid() AS uid)))
  with check ((( SELECT projects.owner_id
   FROM public.projects
  WHERE (projects.id = project_nodes.project_id)) = ( SELECT auth.uid() AS uid)));

-- projects policies

create policy "Authenticated users can create new projects"
  on "public"."projects"
  as permissive
  for insert
  to authenticated
  with check ((owner_id = auth.uid()));

create policy "Users can access their projects"
  on "public"."projects"
  as permissive
  for select
  to public
  using (( SELECT (auth.uid() = projects.owner_id)));

create policy "Users can delete their projects"
  on "public"."projects"
  as permissive
  for delete
  to authenticated
  using ((( SELECT auth.uid() AS uid) = owner_id));

create policy "Users can update their projects"
  on "public"."projects"
  as permissive
  for update
  to authenticated
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

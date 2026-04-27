create extension if not exists "wrappers" with schema "extensions";

drop extension if exists "pg_net";

create type "public"."asset_scope" as enum ('project', 'local_library', 'public_library');

create type "public"."asset_type" as enum ('model', 'material', 'picture');

create type "public"."file_variant" as enum ('original', 'optimized', 'preview');

create type "public"."node_type" as enum ('assembly', 'part');

create type "public"."part_type" as enum ('body', 'neck', 'headstock', 'bridge', 'tuning_machine', 'pickup', 'pickguard', 'knob', 'switch', 'strap_button', 'output_jack', 'miscellaneous');

create type "public"."upload_status" as enum ('approved', 'rejected', 'pending');


  create table "public"."asset_files" (
    "id" uuid not null default gen_random_uuid(),
    "asset_id" uuid,
    "owner_id" uuid not null default auth.uid(),
    "file_variant" public.file_variant not null default 'original'::public.file_variant,
    "bucket" text not null,
    "object_key" text,
    "filename" text,
    "mime_type" text,
    "bytes" bigint,
    "etag" text,
    "sha256" text,
    "meta" jsonb default '{}'::jsonb,
    "created_on" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
      );


alter table "public"."asset_files" enable row level security;


  create table "public"."assets" (
    "id" uuid not null default gen_random_uuid(),
    "owner_id" uuid not null default auth.uid(),
    "name" text not null default ''::text,
    "meta" jsonb not null default '{}'::jsonb,
    "created_on" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "asset_file_id" uuid,
    "part_type" public.part_type,
    "upload_status" public.upload_status,
    "upload_date" timestamp with time zone,
    "preview_file_id" uuid
      );


alter table "public"."assets" enable row level security;


  create table "public"."project_nodes" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null default gen_random_uuid(),
    "type" public.node_type not null,
    "parent_id" uuid default gen_random_uuid(),
    "sort_index" smallint not null default '0'::smallint,
    "name" text not null,
    "asset_id" uuid,
    "transforms" jsonb not null,
    "overrides" jsonb not null,
    "meta" jsonb not null,
    "created_on" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
      );


alter table "public"."project_nodes" enable row level security;


  create table "public"."projects" (
    "id" uuid not null default gen_random_uuid(),
    "owner_id" uuid not null default auth.uid(),
    "name" text not null default ''::text,
    "created_on" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "root_node_id" uuid,
    "preview_file_id" uuid
      );


alter table "public"."projects" enable row level security;

CREATE UNIQUE INDEX asset_file_pkey ON public.asset_files USING btree (id);

CREATE UNIQUE INDEX asset_pkey ON public.assets USING btree (id);

CREATE INDEX assets_part_type_idx ON public.assets USING btree (part_type);

CREATE INDEX assets_upload_status_idx ON public.assets USING btree (upload_status);

CREATE UNIQUE INDEX project_nodea_pkey ON public.project_nodes USING btree (id);

CREATE UNIQUE INDEX project_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX projects_owner_name_unique ON public.projects USING btree (owner_id, name);

alter table "public"."asset_files" add constraint "asset_file_pkey" PRIMARY KEY using index "asset_file_pkey";

alter table "public"."assets" add constraint "asset_pkey" PRIMARY KEY using index "asset_pkey";

alter table "public"."project_nodes" add constraint "project_nodea_pkey" PRIMARY KEY using index "project_nodea_pkey";

alter table "public"."projects" add constraint "project_pkey" PRIMARY KEY using index "project_pkey";

alter table "public"."asset_files" add constraint "asset_file_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."asset_files" validate constraint "asset_file_owner_id_fkey";

alter table "public"."asset_files" add constraint "asset_files_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE not valid;

alter table "public"."asset_files" validate constraint "asset_files_asset_id_fkey";

alter table "public"."assets" add constraint "asset_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."assets" validate constraint "asset_owner_id_fkey";

alter table "public"."assets" add constraint "assets_asset_file_id_fkey" FOREIGN KEY (asset_file_id) REFERENCES public.asset_files(id) ON DELETE CASCADE not valid;

alter table "public"."assets" validate constraint "assets_asset_file_id_fkey";

alter table "public"."assets" add constraint "assets_preview_file_id_fkey" FOREIGN KEY (preview_file_id) REFERENCES public.asset_files(id) ON DELETE SET NULL not valid;

alter table "public"."assets" validate constraint "assets_preview_file_id_fkey";

alter table "public"."project_nodes" add constraint "project_nodes_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE not valid;

alter table "public"."project_nodes" validate constraint "project_nodes_asset_id_fkey";

alter table "public"."project_nodes" add constraint "project_nodes_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES public.project_nodes(id) ON DELETE CASCADE not valid;

alter table "public"."project_nodes" validate constraint "project_nodes_parent_id_fkey";

alter table "public"."project_nodes" add constraint "project_nodes_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_nodes" validate constraint "project_nodes_project_id_fkey";

alter table "public"."projects" add constraint "project_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."projects" validate constraint "project_owner_id_fkey";

alter table "public"."projects" add constraint "projects_owner_name_unique" UNIQUE using index "projects_owner_name_unique";

alter table "public"."projects" add constraint "projects_preview_file_id_fkey" FOREIGN KEY (preview_file_id) REFERENCES public.asset_files(id) ON DELETE SET NULL not valid;

alter table "public"."projects" validate constraint "projects_preview_file_id_fkey";

alter table "public"."projects" add constraint "projects_root_node_id_fkey" FOREIGN KEY (root_node_id) REFERENCES public.project_nodes(id) ON DELETE CASCADE not valid;

alter table "public"."projects" validate constraint "projects_root_node_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_project_with_root(p_name text)
 RETURNS TABLE(project_id uuid, root_node_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_project_id uuid;
  v_root_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Project name is required';
  end if;

  -- Create project (owner_id comes from auth.uid())
  insert into public.projects (owner_id, name)
  values ((select auth.uid()), trim(p_name))
  returning id into v_project_id;

  -- Create root node
  insert into public.project_nodes (project_id, parent_id, type, name, sort_index, transforms, overrides, meta)
  values (v_project_id, null, 'assembly', 'Root', 0, '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}'::jsonb, '{}', '{}')
  returning id into v_root_id;

  -- Link root on project
  update public.projects
  set root_node_id = v_root_id
  where id = v_project_id;

  project_id := v_project_id;
  root_node_id := v_root_id;
  return next;
end;$function$
;

CREATE OR REPLACE FUNCTION public.promote_project_root(p_project_id uuid, p_new_root_node_id uuid)
 RETURNS TABLE(project_id uuid, root_node_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_current_root_node_id uuid;
begin
  select p.root_node_id
  into v_current_root_node_id
  from projects p
  where p.id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  perform 1
  from project_nodes n
  where n.id = p_new_root_node_id
    and n.project_id = p_project_id
  for update;

  if not found then
    raise exception 'New root node does not belong to this project';
  end if;

  if v_current_root_node_id = p_new_root_node_id then
    update project_nodes
    set parent_id = null,
        last_updated = now()
    where id = p_new_root_node_id
      and parent_id is distinct from null;

    return query
    select p_project_id, p_new_root_node_id;
    return;
  end if;

  update project_nodes
  set parent_id = null,
      last_updated = now()
  where id = p_new_root_node_id;

  if v_current_root_node_id is not null
     and v_current_root_node_id <> p_new_root_node_id then
    update project_nodes
    set parent_id = p_new_root_node_id,
        last_updated = now()
    where id = v_current_root_node_id;
  end if;

  update projects
  set root_node_id = p_new_root_node_id,
      last_updated = now()
  where id = p_project_id;

  return query
  select p_project_id, p_new_root_node_id;
end;
$function$
;

grant delete on table "public"."asset_files" to "anon";

grant insert on table "public"."asset_files" to "anon";

grant references on table "public"."asset_files" to "anon";

grant select on table "public"."asset_files" to "anon";

grant trigger on table "public"."asset_files" to "anon";

grant truncate on table "public"."asset_files" to "anon";

grant update on table "public"."asset_files" to "anon";

grant delete on table "public"."asset_files" to "authenticated";

grant insert on table "public"."asset_files" to "authenticated";

grant references on table "public"."asset_files" to "authenticated";

grant select on table "public"."asset_files" to "authenticated";

grant trigger on table "public"."asset_files" to "authenticated";

grant truncate on table "public"."asset_files" to "authenticated";

grant update on table "public"."asset_files" to "authenticated";

grant delete on table "public"."asset_files" to "service_role";

grant insert on table "public"."asset_files" to "service_role";

grant references on table "public"."asset_files" to "service_role";

grant select on table "public"."asset_files" to "service_role";

grant trigger on table "public"."asset_files" to "service_role";

grant truncate on table "public"."asset_files" to "service_role";

grant update on table "public"."asset_files" to "service_role";

grant delete on table "public"."assets" to "anon";

grant insert on table "public"."assets" to "anon";

grant references on table "public"."assets" to "anon";

grant select on table "public"."assets" to "anon";

grant trigger on table "public"."assets" to "anon";

grant truncate on table "public"."assets" to "anon";

grant update on table "public"."assets" to "anon";

grant delete on table "public"."assets" to "authenticated";

grant insert on table "public"."assets" to "authenticated";

grant references on table "public"."assets" to "authenticated";

grant select on table "public"."assets" to "authenticated";

grant trigger on table "public"."assets" to "authenticated";

grant truncate on table "public"."assets" to "authenticated";

grant update on table "public"."assets" to "authenticated";

grant delete on table "public"."assets" to "service_role";

grant insert on table "public"."assets" to "service_role";

grant references on table "public"."assets" to "service_role";

grant select on table "public"."assets" to "service_role";

grant trigger on table "public"."assets" to "service_role";

grant truncate on table "public"."assets" to "service_role";

grant update on table "public"."assets" to "service_role";

grant delete on table "public"."project_nodes" to "anon";

grant insert on table "public"."project_nodes" to "anon";

grant references on table "public"."project_nodes" to "anon";

grant select on table "public"."project_nodes" to "anon";

grant trigger on table "public"."project_nodes" to "anon";

grant truncate on table "public"."project_nodes" to "anon";

grant update on table "public"."project_nodes" to "anon";

grant delete on table "public"."project_nodes" to "authenticated";

grant insert on table "public"."project_nodes" to "authenticated";

grant references on table "public"."project_nodes" to "authenticated";

grant select on table "public"."project_nodes" to "authenticated";

grant trigger on table "public"."project_nodes" to "authenticated";

grant truncate on table "public"."project_nodes" to "authenticated";

grant update on table "public"."project_nodes" to "authenticated";

grant delete on table "public"."project_nodes" to "service_role";

grant insert on table "public"."project_nodes" to "service_role";

grant references on table "public"."project_nodes" to "service_role";

grant select on table "public"."project_nodes" to "service_role";

grant trigger on table "public"."project_nodes" to "service_role";

grant truncate on table "public"."project_nodes" to "service_role";

grant update on table "public"."project_nodes" to "service_role";

grant delete on table "public"."projects" to "anon";

grant insert on table "public"."projects" to "anon";

grant references on table "public"."projects" to "anon";

grant select on table "public"."projects" to "anon";

grant trigger on table "public"."projects" to "anon";

grant truncate on table "public"."projects" to "anon";

grant update on table "public"."projects" to "anon";

grant delete on table "public"."projects" to "authenticated";

grant insert on table "public"."projects" to "authenticated";

grant references on table "public"."projects" to "authenticated";

grant select on table "public"."projects" to "authenticated";

grant trigger on table "public"."projects" to "authenticated";

grant truncate on table "public"."projects" to "authenticated";

grant update on table "public"."projects" to "authenticated";

grant delete on table "public"."projects" to "service_role";

grant insert on table "public"."projects" to "service_role";

grant references on table "public"."projects" to "service_role";

grant select on table "public"."projects" to "service_role";

grant trigger on table "public"."projects" to "service_role";

grant truncate on table "public"."projects" to "service_role";

grant update on table "public"."projects" to "service_role";


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




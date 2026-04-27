-- Tables

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

-- Indexes

CREATE UNIQUE INDEX asset_file_pkey ON public.asset_files USING btree (id);

CREATE UNIQUE INDEX asset_pkey ON public.assets USING btree (id);

CREATE INDEX assets_part_type_idx ON public.assets USING btree (part_type);

CREATE INDEX assets_upload_status_idx ON public.assets USING btree (upload_status);

CREATE UNIQUE INDEX project_nodea_pkey ON public.project_nodes USING btree (id);

CREATE UNIQUE INDEX project_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX projects_owner_name_unique ON public.projects USING btree (owner_id, name);

-- Primary keys

alter table "public"."asset_files" add constraint "asset_file_pkey" PRIMARY KEY using index "asset_file_pkey";

alter table "public"."assets" add constraint "asset_pkey" PRIMARY KEY using index "asset_pkey";

alter table "public"."project_nodes" add constraint "project_nodea_pkey" PRIMARY KEY using index "project_nodea_pkey";

alter table "public"."projects" add constraint "project_pkey" PRIMARY KEY using index "project_pkey";

-- Foreign keys

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

-- Role grants

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

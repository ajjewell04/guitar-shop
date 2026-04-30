alter table "public"."project_nodes"
  alter column "project_id" drop default;

alter table "public"."project_nodes"
  alter column "parent_id" drop default;

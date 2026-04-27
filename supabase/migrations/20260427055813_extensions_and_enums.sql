-- Extensions
create extension if not exists "wrappers" with schema "extensions";

drop extension if exists "pg_net";

-- Enums
create type "public"."asset_scope" as enum ('project', 'local_library', 'public_library');

create type "public"."asset_type" as enum ('model', 'material', 'picture');

create type "public"."file_variant" as enum ('original', 'optimized', 'preview');

create type "public"."node_type" as enum ('assembly', 'part');

create type "public"."part_type" as enum ('body', 'neck', 'headstock', 'bridge', 'tuning_machine', 'pickup', 'pickguard', 'knob', 'switch', 'strap_button', 'output_jack', 'miscellaneous');

create type "public"."upload_status" as enum ('approved', 'rejected', 'pending');

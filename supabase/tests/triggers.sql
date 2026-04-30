-- Trigger tests for set_last_updated.
--
-- Verifies that the BEFORE UPDATE trigger fires on all four tables and
-- overwrites last_updated, regardless of what the application passed.
-- Strategy: insert with an explicit past timestamp, update any column,
-- then assert last_updated is now greater than the past value.
-- All operations run as postgres (superuser) to bypass RLS.

begin;
select plan(4);

-- ── fixtures ─────────────────────────────────────────────────────────────────

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  'b0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'trigger_user@test.com',
  '', now(), '{}', '{}', now(), now()
);

insert into public.assets (id, owner_id, name, last_updated)
values ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Trigger Asset', '2020-01-01 00:00:00+00');

insert into public.asset_files (id, owner_id, asset_id, bucket, file_variant, last_updated)
values ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'test-bucket', 'original', '2020-01-01 00:00:00+00');

insert into public.projects (id, owner_id, name, last_updated)
values ('b3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Trigger Project', '2020-01-01 00:00:00+00');

insert into public.project_nodes (id, project_id, parent_id, type, name, sort_index, transforms, overrides, meta, last_updated)
values (
  'b4000000-0000-0000-0000-000000000001',
  'b3000000-0000-0000-0000-000000000001',
  null, 'assembly', 'Trigger Node', 0,
  '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
  '{}', '{}',
  '2020-01-01 00:00:00+00'
);

-- ── assets ───────────────────────────────────────────────────────────────────

update public.assets set name = 'Updated Asset' where id = 'b1000000-0000-0000-0000-000000000001';

select ok(
  (select last_updated from public.assets where id = 'b1000000-0000-0000-0000-000000000001') > '2020-01-01 00:00:00+00',
  'assets.last_updated is set by trigger on UPDATE'
);

-- ── asset_files ──────────────────────────────────────────────────────────────

update public.asset_files set filename = 'updated.glb' where id = 'b2000000-0000-0000-0000-000000000001';

select ok(
  (select last_updated from public.asset_files where id = 'b2000000-0000-0000-0000-000000000001') > '2020-01-01 00:00:00+00',
  'asset_files.last_updated is set by trigger on UPDATE'
);

-- ── projects ─────────────────────────────────────────────────────────────────

update public.projects set name = 'Updated Project' where id = 'b3000000-0000-0000-0000-000000000001';

select ok(
  (select last_updated from public.projects where id = 'b3000000-0000-0000-0000-000000000001') > '2020-01-01 00:00:00+00',
  'projects.last_updated is set by trigger on UPDATE'
);

-- ── project_nodes ─────────────────────────────────────────────────────────────

update public.project_nodes set name = 'Updated Node' where id = 'b4000000-0000-0000-0000-000000000001';

select ok(
  (select last_updated from public.project_nodes where id = 'b4000000-0000-0000-0000-000000000001') > '2020-01-01 00:00:00+00',
  'project_nodes.last_updated is set by trigger on UPDATE'
);

select * from finish();
rollback;

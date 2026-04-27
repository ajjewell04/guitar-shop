-- RLS policy tests for the project_nodes table.
--
-- Access model: project nodes are private to the project owner.
-- All four operations (select/insert/update/delete) require owning the parent project.

begin;
select plan(13);

-- ── fixtures ────────────────────────────────────────────────────────────────

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'user_a@test.com',
    '', now(), '{}', '{}', now(), now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'user_b@test.com',
    '', now(), '{}', '{}', now(), now()
  );

insert into public.projects (id, owner_id, name)
values ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'User A Project');

-- user_b assets used for cross-link tests
insert into public.assets (id, owner_id, name, upload_status)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'User B Pending Asset',  'pending'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'User B Approved Asset', 'approved');

insert into public.project_nodes (id, project_id, parent_id, type, name, sort_index, transforms, overrides, meta)
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    null, 'assembly', 'Root', 0,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}'
  ),
  (
    'a4000000-0000-0000-0000-000000000002',
    'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001', 'part', 'Delete Node', 1,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}'
  );

update public.projects
  set root_node_id = 'a4000000-0000-0000-0000-000000000001'
  where id = 'a3000000-0000-0000-0000-000000000001';

-- ── SELECT ───────────────────────────────────────────────────────────────────

-- anon cannot see any project nodes
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*)::int from public.project_nodes where project_id = 'a3000000-0000-0000-0000-000000000001'),
  0,
  'anon cannot see any project nodes'
);

-- owner can see their nodes
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.project_nodes where project_id = 'a3000000-0000-0000-0000-000000000001'),
  2,
  'owner can see nodes in their project'
);

-- non-owner cannot see any nodes in another users project
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.project_nodes where project_id = 'a3000000-0000-0000-0000-000000000001'),
  0,
  'non-owner cannot see nodes in another users project'
);

-- ── INSERT ───────────────────────────────────────────────────────────────────

-- owner inserts node into their own project → success
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$
  insert into public.project_nodes (project_id, parent_id, type, name, sort_index, transforms, overrides, meta)
  values (
    'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    'part', 'New Part', 2,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}'
  )
  $$,
  'owner can insert a node into their own project'
);

-- non-owner cannot insert a node into another users project → WITH CHECK violation
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$
  insert into public.project_nodes (project_id, parent_id, type, name, sort_index, transforms, overrides, meta)
  values (
    'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    'part', 'Injected Part', 99,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}'
  )
  $$,
  '42501',
  NULL,
  'non-owner cannot insert a node into another users project'
);

-- ── UPDATE ───────────────────────────────────────────────────────────────────

-- owner updates a node in their project
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

update public.project_nodes
  set name = 'Renamed Root'
  where id = 'a4000000-0000-0000-0000-000000000001';

select is(
  (select name from public.project_nodes where id = 'a4000000-0000-0000-0000-000000000001'),
  'Renamed Root',
  'owner can update a node in their project'
);

-- non-owner update has no effect
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

update public.project_nodes
  set name = 'Hacked'
  where id = 'a4000000-0000-0000-0000-000000000001';

reset role;
select is(
  (select name from public.project_nodes where id = 'a4000000-0000-0000-0000-000000000001'),
  'Renamed Root',
  'non-owner update has no effect on another users node'
);

-- ── DELETE ───────────────────────────────────────────────────────────────────

-- owner deletes their own node
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

delete from public.project_nodes where id = 'a4000000-0000-0000-0000-000000000002';

reset role;
select is(
  (select count(*)::int from public.project_nodes where id = 'a4000000-0000-0000-0000-000000000002'),
  0,
  'owner can delete a node from their project'
);

-- non-owner delete has no effect
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

delete from public.project_nodes where id = 'a4000000-0000-0000-0000-000000000001';

reset role;
select is(
  (select count(*)::int from public.project_nodes where id = 'a4000000-0000-0000-0000-000000000001'),
  1,
  'non-owner delete has no effect on another users node'
);

-- ── ASSET CROSS-LINK ─────────────────────────────────────────────────────────

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- owner cannot INSERT a node referencing a non-owned, non-approved asset
select throws_ok(
  $$
  insert into public.project_nodes (project_id, parent_id, type, name, sort_index, transforms, overrides, meta, asset_id)
  values (
    'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    'part', 'Cross-Linked Part', 5,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}',
    'a1000000-0000-0000-0000-000000000001'
  )
  $$,
  '42501',
  NULL,
  'owner cannot insert a node linking a non-owned pending asset'
);

-- owner cannot UPDATE a node to reference a non-owned, non-approved asset
select throws_ok(
  $$update public.project_nodes set asset_id = 'a1000000-0000-0000-0000-000000000001' where id = 'a4000000-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'owner cannot update a node to link a non-owned pending asset'
);

-- owner CAN INSERT a node referencing another user's approved (community library) asset
select lives_ok(
  $$
  insert into public.project_nodes (project_id, parent_id, type, name, sort_index, transforms, overrides, meta, asset_id)
  values (
    'a3000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    'part', 'Community Part', 6,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}',
    'a1000000-0000-0000-0000-000000000002'
  )
  $$,
  'owner can insert a node linking another user''s approved asset'
);

-- owner CAN UPDATE a node to reference another user's approved (community library) asset
select lives_ok(
  $$update public.project_nodes set asset_id = 'a1000000-0000-0000-0000-000000000002' where id = 'a4000000-0000-0000-0000-000000000001'$$,
  'owner can update a node to link another user''s approved asset'
);

select * from finish();
rollback;

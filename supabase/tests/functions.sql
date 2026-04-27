-- DB function tests for create_project_with_root and promote_project_root.
--
-- create_project_with_root (SECURITY DEFINER):
--   - Creates a project + root node atomically for the calling user
--   - Rejects blank names
--
-- promote_project_root (NOT SECURITY DEFINER, runs as caller role):
--   - Promotes a child node to root, re-parenting the old root under it
--   - No-op when the node is already root
--   - Rejects nodes from other projects
--   - Rejects callers who do not own the project (enforced via RLS)

begin;
select plan(11);

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

-- Fixtures for promote_project_root tests (direct inserts as superuser)
insert into public.projects (id, owner_id, name)
values
  ('f3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Promote Project'),
  ('f3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Other Project');

insert into public.project_nodes (id, project_id, parent_id, type, name, sort_index, transforms, overrides, meta)
values
  -- promote project: root node
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    null, 'assembly', 'Root', 0,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}'
  ),
  -- promote project: child node to be promoted
  (
    'f4000000-0000-0000-0000-000000000002',
    'f3000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001', 'assembly', 'Child', 1,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}'
  ),
  -- other project: root node (used to test cross-project guard)
  (
    'f4000000-0000-0000-0000-000000000003',
    'f3000000-0000-0000-0000-000000000002',
    null, 'assembly', 'Other Root', 0,
    '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
    '{}', '{}'
  );

update public.projects set root_node_id = 'f4000000-0000-0000-0000-000000000001'
  where id = 'f3000000-0000-0000-0000-000000000001';
update public.projects set root_node_id = 'f4000000-0000-0000-0000-000000000003'
  where id = 'f3000000-0000-0000-0000-000000000002';

-- ── create_project_with_root ─────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- capture return values via set_config so we can query them after role reset
select
  set_config('test.created_project_id',  project_id::text,  true),
  set_config('test.created_root_node_id', root_node_id::text, true)
from public.create_project_with_root('Test Project');

reset role;

select ok(
  current_setting('test.created_project_id',  true)::uuid is not null,
  'create_project_with_root returns a project_id'
);

select ok(
  current_setting('test.created_root_node_id', true)::uuid is not null,
  'create_project_with_root returns a root_node_id'
);

select is(
  (select owner_id from public.projects where id = current_setting('test.created_project_id', true)::uuid),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'created project owner matches the calling user'
);

select is(
  (select root_node_id from public.projects where id = current_setting('test.created_project_id', true)::uuid),
  current_setting('test.created_root_node_id', true)::uuid,
  'project.root_node_id matches the returned root_node_id'
);

-- blank name raises exception (SQLSTATE P0001 = raise exception)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select * from public.create_project_with_root('')$$,
  'P0001',
  'Project name is required',
  'create_project_with_root raises exception for blank name'
);

reset role;

-- ── promote_project_root ──────────────────────────────────────────────────────

-- owner promotes child node to root
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select * from public.promote_project_root('f3000000-0000-0000-0000-000000000001'::uuid, 'f4000000-0000-0000-0000-000000000002'::uuid)$$,
  'owner can promote a child node to project root'
);

reset role;

select is(
  (select root_node_id from public.projects where id = 'f3000000-0000-0000-0000-000000000001'),
  'f4000000-0000-0000-0000-000000000002'::uuid,
  'project.root_node_id updated to promoted node'
);

-- promoting the current root again is a no-op (same root returned, no error)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select * from public.promote_project_root('f3000000-0000-0000-0000-000000000001'::uuid, 'f4000000-0000-0000-0000-000000000002'::uuid)$$,
  'promoting the already-root node does not raise an error'
);

reset role;

select is(
  (select root_node_id from public.projects where id = 'f3000000-0000-0000-0000-000000000001'),
  'f4000000-0000-0000-0000-000000000002'::uuid,
  'root_node_id unchanged after no-op promotion'
);

-- promoting a node that belongs to a different project raises exception
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select * from public.promote_project_root('f3000000-0000-0000-0000-000000000001'::uuid, 'f4000000-0000-0000-0000-000000000003'::uuid)$$,
  'P0001',
  'New root node does not belong to this project',
  'promote_project_root raises exception for node from a different project'
);

-- non-owner call raises "Project not found" (projects SELECT RLS blocks access)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$select * from public.promote_project_root('f3000000-0000-0000-0000-000000000001'::uuid, 'f4000000-0000-0000-0000-000000000002'::uuid)$$,
  'P0001',
  'Project not found',
  'non-owner cannot promote a node in another users project'
);

reset role;

select * from finish();
rollback;

-- RLS policy tests for the projects table.
--
-- Access model: projects are strictly private — owner-only for all operations.
-- Guests (anon) cannot see any projects.

begin;
select plan(9);

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
values
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'User A Project'),
  ('a3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'User A Delete Project');

-- ── SELECT ───────────────────────────────────────────────────────────────────

-- anon cannot see any projects
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*)::int from public.projects),
  0,
  'anon cannot see any projects'
);

-- owner can see their own project
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.projects where id = 'a3000000-0000-0000-0000-000000000001'),
  1,
  'owner can see their own project'
);

-- non-owner cannot see another users project
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.projects where id = 'a3000000-0000-0000-0000-000000000001'),
  0,
  'non-owner cannot see another users project'
);

-- ── INSERT ───────────────────────────────────────────────────────────────────

-- owner inserts project with correct owner_id → success
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.projects (owner_id, name) values ('a0000000-0000-0000-0000-000000000001', 'New Project')$$,
  'owner can insert project with correct owner_id'
);

-- authenticated user inserts with a different owner_id → WITH CHECK violation
select throws_ok(
  $$insert into public.projects (owner_id, name) values ('a0000000-0000-0000-0000-000000000002', 'Hijacked Project')$$,
  '42501',
  NULL,
  'authenticated user cannot insert project with a different owner_id'
);

-- ── UPDATE ───────────────────────────────────────────────────────────────────

-- owner updates their own project
update public.projects
  set name = 'Renamed Project'
  where id = 'a3000000-0000-0000-0000-000000000001';

select is(
  (select name from public.projects where id = 'a3000000-0000-0000-0000-000000000001'),
  'Renamed Project',
  'owner can update their own project'
);

-- non-owner update has no effect
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

update public.projects
  set name = 'Hacked'
  where id = 'a3000000-0000-0000-0000-000000000001';

reset role;
select is(
  (select name from public.projects where id = 'a3000000-0000-0000-0000-000000000001'),
  'Renamed Project',
  'non-owner update has no effect on another users project'
);

-- ── DELETE ───────────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

delete from public.projects where id = 'a3000000-0000-0000-0000-000000000002';

reset role;
select is(
  (select count(*)::int from public.projects where id = 'a3000000-0000-0000-0000-000000000002'),
  0,
  'owner can delete their own project'
);

-- non-owner delete attempt has no effect
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

delete from public.projects where id = 'a3000000-0000-0000-0000-000000000001';

reset role;
select is(
  (select count(*)::int from public.projects where id = 'a3000000-0000-0000-0000-000000000001'),
  1,
  'non-owner delete has no effect on another user''s project'
);

select * from finish();
rollback;

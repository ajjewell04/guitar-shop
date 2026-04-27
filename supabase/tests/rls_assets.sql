-- RLS policy tests for the assets table.
--
-- Access model:
--   approved assets  → readable by anon + authenticated
--   pending/rejected → readable by owner only
--   insert/update/delete → authenticated owner only

begin;
select plan(14);

-- ── fixtures (as postgres superuser, bypasses RLS) ──────────────────────────

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

insert into public.assets (id, owner_id, name, upload_status)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Approved Asset',  'approved'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Pending Asset',   'pending'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Delete Asset',    'pending'),
  ('a1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Rejected Asset',  'rejected');

-- ── SELECT: anon (guest) ─────────────────────────────────────────────────────

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*)::int from public.assets where id = 'a1000000-0000-0000-0000-000000000001'),
  1,
  'anon can see approved asset'
);

select is(
  (select count(*)::int from public.assets where id = 'a1000000-0000-0000-0000-000000000002'),
  0,
  'anon cannot see pending asset'
);

select is(
  (select count(*)::int from public.assets where id = 'a1000000-0000-0000-0000-000000000004'),
  0,
  'anon cannot see rejected asset'
);

-- ── SELECT: authenticated non-owner (user_b) ─────────────────────────────────

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.assets where id = 'a1000000-0000-0000-0000-000000000001'),
  1,
  'authenticated non-owner can see approved asset'
);

select is(
  (select count(*)::int from public.assets where id = 'a1000000-0000-0000-0000-000000000002'),
  0,
  'authenticated non-owner cannot see another users pending asset'
);

-- ── SELECT: owner (user_a) sees own pending ───────────────────────────────────

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.assets where id = 'a1000000-0000-0000-0000-000000000002'),
  1,
  'owner can see their own pending asset'
);

-- ── INSERT ───────────────────────────────────────────────────────────────────

-- owner inserts with their own owner_id → success
select lives_ok(
  $$insert into public.assets (owner_id, name) values ('a0000000-0000-0000-0000-000000000001', 'New Asset')$$,
  'owner can insert asset with correct owner_id'
);

-- authenticated user tries to insert with a different owner_id → WITH CHECK violation
select throws_ok(
  $$insert into public.assets (owner_id, name) values ('a0000000-0000-0000-0000-000000000002', 'Hijacked Asset')$$,
  '42501',
  NULL,
  'authenticated user cannot insert asset with a different owner_id'
);

-- ── UPDATE ───────────────────────────────────────────────────────────────────

-- owner updates their own pending asset
update public.assets
  set name = 'Updated Name'
  where id = 'a1000000-0000-0000-0000-000000000002';

select is(
  (select name from public.assets where id = 'a1000000-0000-0000-0000-000000000002'),
  'Updated Name',
  'owner can update their own asset'
);

-- non-owner update has no effect (row is invisible via USING clause)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

update public.assets
  set name = 'Hacked'
  where id = 'a1000000-0000-0000-0000-000000000002';

reset role;
select is(
  (select name from public.assets where id = 'a1000000-0000-0000-0000-000000000002'),
  'Updated Name',
  'non-owner update has no effect on another users asset'
);

-- ── DELETE ───────────────────────────────────────────────────────────────────

-- owner deletes their own asset
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

delete from public.assets where id = 'a1000000-0000-0000-0000-000000000003';

reset role;
select is(
  (select count(*)::int from public.assets where id = 'a1000000-0000-0000-0000-000000000003'),
  0,
  'owner can delete their own asset'
);

-- non-owner delete has no effect (row invisible via USING)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

delete from public.assets where id = 'a1000000-0000-0000-0000-000000000002';

reset role;
select is(
  (select count(*)::int from public.assets where id = 'a1000000-0000-0000-0000-000000000002'),
  1,
  'non-owner delete has no effect on another users asset'
);

-- ── STATUS PUBLISHING ─────────────────────────────────────────────────────────

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- owner cannot INSERT an asset that is already approved (self-approval bypasses review)
select throws_ok(
  $$insert into public.assets (owner_id, name, upload_status) values ('a0000000-0000-0000-0000-000000000001', 'Self-Approved Asset', 'approved')$$,
  '42501',
  NULL,
  'owner cannot insert an asset with upload_status approved'
);

-- owner cannot UPDATE their own asset to approved (self-approval bypasses review)
select throws_ok(
  $$update public.assets set upload_status = 'approved' where id = 'a1000000-0000-0000-0000-000000000002'$$,
  '42501',
  NULL,
  'owner cannot self-approve their own pending asset'
);

select * from finish();
rollback;

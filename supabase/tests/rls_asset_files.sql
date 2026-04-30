-- RLS policy tests for the asset_files table.
--
-- Access model:
--   files for approved assets  → readable by anon + authenticated
--   files for pending assets   → readable by owner only
--   project preview files (asset_id IS NULL) → readable by owner only
--   insert/update/delete → authenticated owner only

begin;
select plan(19);

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

insert into public.assets (id, owner_id, name, upload_status)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Approved Asset', 'approved'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Pending Asset',  'pending'),
  -- user_b asset used for cross-ownership tests
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'User B Asset',   'pending');

insert into public.asset_files (id, owner_id, asset_id, bucket, file_variant)
values
  -- file linked to approved asset
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'test-bucket', 'original'),
  -- file linked to pending asset
  ('a2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'test-bucket', 'original'),
  -- project preview: no parent asset (asset_id IS NULL)
  ('a2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', null,                                   'test-bucket', 'preview'),
  -- extra file used for update / delete tests
  ('a2000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'test-bucket', 'original');

-- ── SELECT: anon (guest) ─────────────────────────────────────────────────────

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000001'),
  1,
  'anon can see files for approved assets'
);

select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000002'),
  0,
  'anon cannot see files for pending assets'
);

select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000003'),
  0,
  'anon cannot see project preview files (asset_id IS NULL)'
);

-- ── anon write rejections ─────────────────────────────────────────────────────

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$insert into public.asset_files (owner_id, asset_id, bucket) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'test-bucket')$$,
  '42501', NULL, 'anon cannot insert into asset_files'
);

select throws_ok(
  $$update public.asset_files set filename = 'hacked.glb' where id = 'a2000000-0000-0000-0000-000000000001'$$,
  '42501', NULL, 'anon cannot update asset_files'
);

select throws_ok(
  $$delete from public.asset_files where id = 'a2000000-0000-0000-0000-000000000001'$$,
  '42501', NULL, 'anon cannot delete from asset_files'
);

reset role;

-- ── SELECT: authenticated non-owner (user_b) ─────────────────────────────────

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000001'),
  1,
  'authenticated non-owner can see files for approved assets'
);

select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000002'),
  0,
  'authenticated non-owner cannot see files for pending assets'
);

-- ── SELECT: owner (user_a) ───────────────────────────────────────────────────

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000002'),
  1,
  'owner can see their own files for a pending asset'
);

select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000003'),
  1,
  'owner can see their own project preview files (asset_id IS NULL)'
);

-- ── INSERT ───────────────────────────────────────────────────────────────────

-- owner inserts with correct owner_id → success
select lives_ok(
  $$insert into public.asset_files (owner_id, asset_id, bucket) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'test-bucket')$$,
  'owner can insert asset file with correct owner_id'
);

-- owner inserts with asset_id = NULL (project preview file) → success
select lives_ok(
  $$insert into public.asset_files (owner_id, asset_id, bucket, file_variant) values ('a0000000-0000-0000-0000-000000000001', null, 'test-bucket', 'preview')$$,
  'owner can insert asset file with null asset_id (project preview)'
);

-- authenticated user inserts with a different owner_id → WITH CHECK violation
select throws_ok(
  $$insert into public.asset_files (owner_id, asset_id, bucket) values ('a0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'test-bucket')$$,
  '42501',
  NULL,
  'authenticated user cannot insert asset file with a different owner_id'
);

-- user inserts with their own owner_id but against another user's asset → WITH CHECK violation
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.asset_files (owner_id, asset_id, bucket) values ('a0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'test-bucket')$$,
  '42501',
  NULL,
  'user cannot insert asset file against another user''s asset'
);

-- ── UPDATE ───────────────────────────────────────────────────────────────────

-- owner updates their own file
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

update public.asset_files
  set filename = 'updated.glb'
  where id = 'a2000000-0000-0000-0000-000000000004';

reset role;
select is(
  (select filename from public.asset_files where id = 'a2000000-0000-0000-0000-000000000004'),
  'updated.glb',
  'owner can update their own asset file'
);

-- non-owner update attempt has no effect
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

update public.asset_files
  set filename = 'hacked.glb'
  where id = 'a2000000-0000-0000-0000-000000000004';

reset role;
select is(
  (select filename from public.asset_files where id = 'a2000000-0000-0000-0000-000000000004'),
  'updated.glb',
  'non-owner update has no effect on another user''s asset file'
);

-- ── PREVIEW / FILE OWNERSHIP ─────────────────────────────────────────────────

-- owner cannot UPDATE asset_file.asset_id to point to another user's asset
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$update public.asset_files set asset_id = 'a1000000-0000-0000-0000-000000000003' where id = 'a2000000-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'owner cannot update asset_file to link to another user''s asset'
);

-- ── DELETE ───────────────────────────────────────────────────────────────────

-- owner deletes their own file
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

delete from public.asset_files where id = 'a2000000-0000-0000-0000-000000000002';

reset role;
select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000002'),
  0,
  'owner can delete their own asset file'
);

-- non-owner delete attempt has no effect
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

delete from public.asset_files where id = 'a2000000-0000-0000-0000-000000000001';

reset role;
select is(
  (select count(*)::int from public.asset_files where id = 'a2000000-0000-0000-0000-000000000001'),
  1,
  'non-owner delete has no effect on another user''s asset file'
);

select * from finish();
rollback;

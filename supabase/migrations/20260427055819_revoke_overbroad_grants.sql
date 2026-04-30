-- anon: revoke all write-path and DBA-level grants. SELECT is kept because the
-- approved-asset RLS policies legitimately allow anon reads. The app never
-- issues DB queries as anon (all access goes through supabaseServer()), so
-- removing write grants closes a defense-in-depth gap without any behavior
-- change for live traffic.
--
-- authenticated: TRIGGER, TRUNCATE, and REFERENCES are DBA-level privileges
-- not needed by an application role. They were included by the Supabase default
-- grant template. Only SELECT/INSERT/UPDATE/DELETE are kept.

-- ── asset_files ──────────────────────────────────────────────────────────────

revoke delete, insert, update, trigger, truncate, references
  on table "public"."asset_files" from "anon";

revoke trigger, truncate, references
  on table "public"."asset_files" from "authenticated";

-- ── assets ───────────────────────────────────────────────────────────────────

revoke delete, insert, update, trigger, truncate, references
  on table "public"."assets" from "anon";

revoke trigger, truncate, references
  on table "public"."assets" from "authenticated";

-- ── project_nodes ────────────────────────────────────────────────────────────

revoke delete, insert, update, trigger, truncate, references
  on table "public"."project_nodes" from "anon";

revoke trigger, truncate, references
  on table "public"."project_nodes" from "authenticated";

-- ── projects ─────────────────────────────────────────────────────────────────

revoke delete, insert, update, trigger, truncate, references
  on table "public"."projects" from "anon";

revoke trigger, truncate, references
  on table "public"."projects" from "authenticated";

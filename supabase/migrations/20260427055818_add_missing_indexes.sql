-- project_nodes: project_id appears in all 4 RLS policies via sub-select on projects;
-- parent_id is used in tree-traversal queries.
CREATE INDEX IF NOT EXISTS project_nodes_project_id_idx
  ON public.project_nodes USING btree (project_id);

CREATE INDEX IF NOT EXISTS project_nodes_parent_id_idx
  ON public.project_nodes USING btree (parent_id);

-- assets: owner_id drives both RLS and the owner-fetch query path.
CREATE INDEX IF NOT EXISTS assets_owner_id_idx
  ON public.assets USING btree (owner_id);

-- asset_files: owner_id and asset_id appear in every RLS policy and join.
CREATE INDEX IF NOT EXISTS asset_files_owner_id_idx
  ON public.asset_files USING btree (owner_id);

CREATE INDEX IF NOT EXISTS asset_files_asset_id_idx
  ON public.asset_files USING btree (asset_id);

-- projects: owner_id is the sole filter for all project RLS policies.
CREATE INDEX IF NOT EXISTS projects_owner_id_idx
  ON public.projects USING btree (owner_id);

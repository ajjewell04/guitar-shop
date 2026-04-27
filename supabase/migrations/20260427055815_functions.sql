set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_project_with_root(p_name text)
 RETURNS TABLE(project_id uuid, root_node_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_project_id uuid;
  v_root_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Project name is required';
  end if;

  -- Create project (owner_id comes from auth.uid())
  insert into public.projects (owner_id, name)
  values ((select auth.uid()), trim(p_name))
  returning id into v_project_id;

  -- Create root node
  insert into public.project_nodes (project_id, parent_id, type, name, sort_index, transforms, overrides, meta)
  values (v_project_id, null, 'assembly', 'Root', 0, '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}'::jsonb, '{}', '{}')
  returning id into v_root_id;

  -- Link root on project
  update public.projects
  set root_node_id = v_root_id
  where id = v_project_id;

  project_id := v_project_id;
  root_node_id := v_root_id;
  return next;
end;$function$
;

CREATE OR REPLACE FUNCTION public.promote_project_root(p_project_id uuid, p_new_root_node_id uuid)
 RETURNS TABLE(project_id uuid, root_node_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_current_root_node_id uuid;
begin
  select p.root_node_id
  into v_current_root_node_id
  from projects p
  where p.id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  perform 1
  from project_nodes n
  where n.id = p_new_root_node_id
    and n.project_id = p_project_id
  for update;

  if not found then
    raise exception 'New root node does not belong to this project';
  end if;

  if v_current_root_node_id = p_new_root_node_id then
    update project_nodes
    set parent_id = null,
        last_updated = now()
    where id = p_new_root_node_id
      and parent_id is distinct from null;

    return query
    select p_project_id, p_new_root_node_id;
    return;
  end if;

  update project_nodes
  set parent_id = null,
      last_updated = now()
  where id = p_new_root_node_id;

  if v_current_root_node_id is not null
     and v_current_root_node_id <> p_new_root_node_id then
    update project_nodes
    set parent_id = p_new_root_node_id,
        last_updated = now()
    where id = v_current_root_node_id;
  end if;

  update projects
  set root_node_id = p_new_root_node_id,
      last_updated = now()
  where id = p_project_id;

  return query
  select p_project_id, p_new_root_node_id;
end;
$function$
;

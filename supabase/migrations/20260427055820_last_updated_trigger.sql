set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_last_updated()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
begin
  NEW.last_updated := now();
  return NEW;
end;
$$;

CREATE TRIGGER set_last_updated_assets
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_last_updated();

CREATE TRIGGER set_last_updated_asset_files
  BEFORE UPDATE ON public.asset_files
  FOR EACH ROW EXECUTE FUNCTION public.set_last_updated();

CREATE TRIGGER set_last_updated_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_last_updated();

CREATE TRIGGER set_last_updated_project_nodes
  BEFORE UPDATE ON public.project_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_last_updated();

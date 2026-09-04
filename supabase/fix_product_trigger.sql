-- Fix the trigger on the Product table
-- The Product table uses the column name "user" instead of "user_id"
-- So the generic set_workspace_user_id trigger fails when applied to it

-- 1. Drop the incorrect trigger if it exists
DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Product";

-- 2. Create a specific function for the Product table
CREATE OR REPLACE FUNCTION public.set_workspace_user_id_product()
RETURNS trigger AS $$
DECLARE
  active_ws_id bigint;
  current_uid bigint;
BEGIN
  current_uid := public.get_current_user_id();
  
  SELECT active_workspace_id INTO active_ws_id 
  FROM public.users 
  WHERE id = current_uid;

  -- If user has an active workspace set (team workspace), use it
  IF active_ws_id IS NOT NULL THEN
    NEW."user" := active_ws_id;
  ELSE
    NEW."user" := current_uid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the correct trigger for the Product table
DROP TRIGGER IF EXISTS trg_set_workspace_user_id_product ON public."Product";
CREATE TRIGGER trg_set_workspace_user_id_product
  BEFORE INSERT ON public."Product"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_user_id_product();

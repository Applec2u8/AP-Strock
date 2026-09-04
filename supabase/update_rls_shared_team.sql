CREATE OR REPLACE FUNCTION public.can_access_data(data_owner_id bigint)
RETURNS boolean AS $$
DECLARE
  current_uid bigint;
  has_access boolean;
BEGIN
  current_uid := public.get_current_user_id();
  
  IF data_owner_id = current_uid THEN
    RETURN true;
  END IF;

  -- Check if they share ANY team
  SELECT EXISTS (
    SELECT 1 
    FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = data_owner_id AND tm2.user_id = current_uid
  ) INTO has_access;

  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix circular dependency in RLS by using SECURITY DEFINER functions

-- Function to safely check if a user is a member of a team
CREATE OR REPLACE FUNCTION public.is_team_member(check_team_id bigint, check_user_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_id = check_team_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely check if a user is the owner of a team
CREATE OR REPLACE FUNCTION public.is_team_owner(check_team_id bigint, check_user_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams 
    WHERE id = check_team_id AND owner_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update policies for teams
DROP POLICY IF EXISTS "Users can view teams they are part of" ON public.teams;
CREATE POLICY "Users can view teams they are part of"
  ON public.teams
  FOR SELECT
  USING (
    owner_id = public.get_current_user_id() OR 
    public.is_team_member(id, public.get_current_user_id())
  );

-- Update policies for team_members
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
CREATE POLICY "Users can view team members of their teams"
  ON public.team_members
  FOR SELECT
  USING (
    user_id = public.get_current_user_id() OR
    public.is_team_owner(team_id, public.get_current_user_id())
  );

DROP POLICY IF EXISTS "Team owners can manage team members" ON public.team_members;
CREATE POLICY "Team owners can manage team members"
  ON public.team_members
  FOR ALL
  USING (
    public.is_team_owner(team_id, public.get_current_user_id())
  );

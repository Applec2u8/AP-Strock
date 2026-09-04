-- Fix: Allow ALL team members to see ALL members of their shared team
-- This fixes the issue where members could only see their own row

-- First, recreate is_team_member helper (bypass RLS to prevent infinite recursion)
CREATE OR REPLACE FUNCTION public.is_team_member(check_team_id bigint, check_user_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_id = check_team_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix team_members SELECT policy
-- OLD: member could only see their own row OR rows if they are the owner
-- NEW: any member of a team can see ALL members of that team
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
CREATE POLICY "Users can view team members of their teams"
  ON public.team_members
  FOR SELECT
  USING (
    -- If the current user is a member of the same team, they can see all team members
    public.is_team_member(team_id, public.get_current_user_id())
  );

-- Keep owner management policy intact
DROP POLICY IF EXISTS "Team owners can manage team members" ON public.team_members;
CREATE POLICY "Team owners can manage team members"
  ON public.team_members
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = public.get_current_user_id())
  );

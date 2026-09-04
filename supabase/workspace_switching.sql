-- ============================================================
-- WORKSPACE SWITCHING - FINAL CORRECT VERSION
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================================

-- Step 1: Add active_workspace_id to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS active_workspace_id bigint 
REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 2: Update can_access_data to use active_workspace_id for DATA tables
-- IMPORTANT: This function is used by Phase, Product, Order, Expenses - NOT users table
-- The users table has its own open SELECT policy (all authenticated can read)
CREATE OR REPLACE FUNCTION public.can_access_data(data_owner_id bigint)
RETURNS boolean AS $$
DECLARE
  current_uid bigint;
  active_ws_id bigint;
  has_access boolean;
BEGIN
  current_uid := public.get_current_user_id();
  
  -- Get user's active workspace (bypass RLS by using SECURITY DEFINER)
  -- We fetch directly, no RLS issues since this function is SECURITY DEFINER
  SELECT active_workspace_id INTO active_ws_id 
  FROM public.users 
  WHERE id = current_uid;
  
  -- If active_ws_id is NULL, default to current_uid (personal workspace)
  IF active_ws_id IS NULL THEN
    active_ws_id := current_uid;
  END IF;

  -- Data must belong to the active workspace to be visible
  IF data_owner_id = active_ws_id THEN
    -- If viewing own workspace, always allow
    IF active_ws_id = current_uid THEN
      RETURN true;
    END IF;

    -- If viewing a team workspace, verify we are actually a member of that team
    SELECT EXISTS (
      SELECT 1 
      FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = active_ws_id AND tm2.user_id = current_uid
    ) INTO has_access;
    
    RETURN has_access;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Trigger function - auto-set user_id on INSERT based on active_workspace
CREATE OR REPLACE FUNCTION public.set_workspace_user_id()
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
    NEW.user_id := active_ws_id;
  ELSE
    NEW.user_id := current_uid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Apply trigger to all data tables
DO $$
BEGIN
  -- Phase
  DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Phase";
  CREATE TRIGGER trg_set_workspace_user_id
    BEFORE INSERT ON public."Phase"
    FOR EACH ROW
    EXECUTE FUNCTION public.set_workspace_user_id();

  -- Category
  DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Category";
  CREATE TRIGGER trg_set_workspace_user_id
    BEFORE INSERT ON public."Category"
    FOR EACH ROW
    EXECUTE FUNCTION public.set_workspace_user_id();

  -- Product (uses "user" column instead of user_id)
  -- Note: Product table uses "user" column, handled by frontend

  -- Order
  DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Order";
  CREATE TRIGGER trg_set_workspace_user_id
    BEFORE INSERT ON public."Order"
    FOR EACH ROW
    EXECUTE FUNCTION public.set_workspace_user_id();

  -- Expenses
  DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Expenses";
  CREATE TRIGGER trg_set_workspace_user_id
    BEFORE INSERT ON public."Expenses"
    FOR EACH ROW
    EXECUTE FUNCTION public.set_workspace_user_id();
END;
$$;

-- Step 5: Ensure users table SELECT policy is open (does NOT use can_access_data)
-- This is CRITICAL - users must always be able to read their own profile 
-- even when active_workspace_id is set to a team owner
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
CREATE POLICY "Authenticated users can read users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);  -- All authenticated users can read any user profile (needed for team management)

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid())  -- Can only update own record
  WITH CHECK (auth_id = auth.uid());

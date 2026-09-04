-- ==========================================
-- setup.sql
-- ==========================================

-- Setup SQL for AP-Strock-Re1
-- You can run this in your Supabase SQL Editor to create the necessary tables and storage buckets.

-- 1. Create tables

-- Table: users (assuming a custom public users table)
CREATE TABLE IF NOT EXISTS public.users (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email text,
  fullname text,
  tel text,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: Phase
CREATE TABLE IF NOT EXISTS public."Phase" (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  phase_name text NOT NULL,
  status text CHECK (status IN ('active', 'closed')),
  created_at timestamp with time zone DEFAULT now()
);

-- Table: Category
CREATE TABLE IF NOT EXISTS public."Category" (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: Payee
CREATE TABLE IF NOT EXISTS public."Payee" (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: Product
CREATE TABLE IF NOT EXISTS public."Product" (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pro_img text,
  pro_name text NOT NULL,
  sku text,
  quantity integer DEFAULT 0,
  qty_sale integer DEFAULT 0,
  qty_stock integer DEFAULT 0,
  cost_price numeric,
  sell_price numeric,
  cate_id bigint REFERENCES public."Category"(id) ON DELETE SET NULL,
  "user" bigint REFERENCES public.users(id) ON DELETE SET NULL,
  phase_id bigint REFERENCES public."Phase"(id) ON DELETE CASCADE,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: Order
CREATE TABLE IF NOT EXISTS public."Order" (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pm_type text,
  sale_price numeric,
  address text,
  total_qty integer,
  delivery_confirmed text DEFAULT 'false',
  promotion text,
  payee bigint REFERENCES public."Payee"(id) ON DELETE SET NULL,
  user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  "order" integer,
  phase_id bigint REFERENCES public."Phase"(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: OrderItem
CREATE TABLE IF NOT EXISTS public."OrderItem" (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id bigint REFERENCES public."Order"(id) ON DELETE CASCADE,
  pro_id bigint REFERENCES public."Product"(id) ON DELETE SET NULL,
  qty integer DEFAULT 1,
  price numeric,
  phase_id bigint REFERENCES public."Phase"(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: OrderPayment
CREATE TABLE IF NOT EXISTS public."OrderPayment" (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id bigint REFERENCES public."Order"(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payee text NOT NULL,
  pm_type text,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: Expenses
CREATE TABLE IF NOT EXISTS public."Expenses" (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  description text NOT NULL,
  amount numeric NOT NULL,
  category text,
  date date,
  phase_id bigint REFERENCES public."Phase"(id) ON DELETE CASCADE,
  payee_id bigint REFERENCES public."Payee"(id) ON DELETE SET NULL,
  user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Storage Buckets (ap_system)
-- Create bucket if it doesn't exist (assuming you have access to storage.buckets)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ap_system', 'ap_system', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for ap_system bucket (allowing public read/write for simplicity, adjust as needed)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'ap_system');

CREATE POLICY "Insert Access" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'ap_system');


-- ==========================================
-- auth_teams_migration.sql
-- ==========================================

-- Migration for Auth, RLS, and Teams

-- 1. Modify existing `users` table to link with Supabase Auth
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- We will also add an email unique constraint to users if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END;
$$;

-- 2. Create `teams` table
CREATE TABLE IF NOT EXISTS public.teams (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text,
  owner_id bigint REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Create `team_members` table
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id bigint REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id bigint REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- 4. Create Database Trigger for new user signup
-- When a user signs up via Supabase Auth, automatically insert a row in public.users and public.teams
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_user_id bigint;
  new_team_id bigint;
BEGIN
  -- Insert into public.users
  INSERT INTO public.users (auth_id, email, fullname)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name')
  RETURNING id INTO new_user_id;

  -- Create a default team for this user
  INSERT INTO public.teams (name, owner_id)
  VALUES (COALESCE(new.raw_user_meta_data->>'full_name', 'My Team'), new_user_id)
  RETURNING id INTO new_team_id;

  -- Add the user as a member to their own team
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team_id, new_user_id, 'owner');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 5. Helper function to get current user's public.users id
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS bigint AS $$
DECLARE
  uid bigint;
BEGIN
  SELECT id INTO uid FROM public.users WHERE auth_id = auth.uid();
  RETURN uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user can access data owned by data_owner_id
CREATE OR REPLACE FUNCTION public.can_access_data(data_owner_id bigint)
RETURNS boolean AS $$
DECLARE
  current_uid bigint;
  has_access boolean;
BEGIN
  -- Get current user id
  current_uid := public.get_current_user_id();
  
  -- If I am the owner, return true
  IF data_owner_id = current_uid THEN
    RETURN true;
  END IF;

  -- Check if there is a team where the data owner is the team owner, and I am a member
  SELECT EXISTS (
    SELECT 1 
    FROM public.team_members tm
    JOIN public.teams t ON tm.team_id = t.id
    WHERE t.owner_id = data_owner_id AND tm.user_id = current_uid
  ) INTO has_access;

  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Phase Table (per-user isolation)
ALTER TABLE public."Phase" ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public."Phase" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage phases" ON public."Phase";
DROP POLICY IF EXISTS "Users can view and edit their team's phases" ON public."Phase";
CREATE POLICY "Users can view and edit their team's phases"
  ON public."Phase"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));

-- Category Table â€” add user_id for per-user isolation
ALTER TABLE public."Category" ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES public.users(id) ON DELETE SET NULL;

-- Delete old categories with no owner (or you can manually reassign them in Supabase Table Editor)
-- DELETE FROM public."Category" WHERE user_id IS NULL;

ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public."Category";
DROP POLICY IF EXISTS "Users can view and edit their team's Categories" ON public."Category";
CREATE POLICY "Users can view and edit their team's Categories"
  ON public."Category"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));

-- Payee Table (shared resource â€” all authenticated users can manage)
ALTER TABLE public."Payee" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage payees" ON public."Payee";
CREATE POLICY "Authenticated users can manage payees"
  ON public."Payee"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- users Table (authenticated users can read all users for team management)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
CREATE POLICY "Authenticated users can read users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid());

-- Product Table
ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view and edit their team's Products" ON public."Product";
CREATE POLICY "Users can view and edit their team's Products"
  ON public."Product"
  FOR ALL
  USING (public.can_access_data("user"))
  WITH CHECK (public.can_access_data("user"));

-- Order Table
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view and edit their team's Orders" ON public."Order";
CREATE POLICY "Users can view and edit their team's Orders"
  ON public."Order"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));

-- OrderItem Table (depends on Order's phase or just Order ID)
-- Since OrderItem doesn't have user_id, we join with Order
ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view and edit their team's OrderItems" ON public."OrderItem";
CREATE POLICY "Users can view and edit their team's OrderItems"
  ON public."OrderItem"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."Order" o 
      WHERE o.id = "OrderItem".order_id AND public.can_access_data(o.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Order" o 
      WHERE o.id = "OrderItem".order_id AND public.can_access_data(o.user_id)
    )
  );

-- OrderPayment Table
ALTER TABLE public."OrderPayment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view and edit their team's OrderPayments" ON public."OrderPayment";
CREATE POLICY "Users can view and edit their team's OrderPayments"
  ON public."OrderPayment"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."Order" o 
      WHERE o.id = "OrderPayment".order_id AND public.can_access_data(o.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Order" o 
      WHERE o.id = "OrderPayment".order_id AND public.can_access_data(o.user_id)
    )
  );

-- Expenses Table
ALTER TABLE public."Expenses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view and edit their team's Expenses" ON public."Expenses";
CREATE POLICY "Users can view and edit their team's Expenses"
  ON public."Expenses"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));

-- We also need RLS on teams and team_members
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view teams they are part of" ON public.teams;
CREATE POLICY "Users can view teams they are part of"
  ON public.teams
  FOR SELECT
  USING (
    owner_id = public.get_current_user_id() OR 
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = id AND tm.user_id = public.get_current_user_id())
  );
  
DROP POLICY IF EXISTS "Users can insert teams" ON public.teams;
CREATE POLICY "Users can insert teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (owner_id = public.get_current_user_id());
  
DROP POLICY IF EXISTS "Team owners can update/delete their teams" ON public.teams;
CREATE POLICY "Team owners can update/delete their teams"
  ON public.teams
  FOR ALL
  USING (owner_id = public.get_current_user_id());

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
CREATE POLICY "Users can view team members of their teams"
  ON public.team_members
  FOR SELECT
  USING (
    user_id = public.get_current_user_id() OR
    EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = team_id AND (t.owner_id = public.get_current_user_id())
    )
  );

DROP POLICY IF EXISTS "Team owners can manage team members" ON public.team_members;
CREATE POLICY "Team owners can manage team members"
  ON public.team_members
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = public.get_current_user_id())
  );


-- ==========================================
-- strict_user_isolation.sql
-- ==========================================

-- 0.0 Ensure auth_id column exists on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END;
$$;

-- 0.1 Sync missing users from auth.users to public.users safely
UPDATE public.users
SET auth_id = auth.users.id
FROM auth.users
WHERE public.users.email = auth.users.email
  AND public.users.auth_id IS NULL;

INSERT INTO public.users (auth_id, email, fullname)
SELECT id, email, raw_user_meta_data->>'full_name'
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE public.users.auth_id = auth.users.id
)
ON CONFLICT (email) DO NOTHING;

-- 0.2 Ensure RLS on public.users allows reading
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
CREATE POLICY "Authenticated users can read users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- 1. Ensure user_id columns exist on all relevant tables
ALTER TABLE public."Phase" ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public."Category" ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public."Payee" ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public."Expenses" ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public."Product" ADD COLUMN IF NOT EXISTS "user" bigint REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Drop existing policies to avoid conflicts and messy overlap
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('Phase', 'Category', 'Payee', 'Product', 'Order', 'OrderItem', 'OrderPayment', 'Expenses')) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 3. Replace public.can_access_data to strictly enforce ONLY the direct owner
CREATE OR REPLACE FUNCTION public.can_access_data(data_owner_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN data_owner_id = public.get_current_user_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable RLS on all tables
ALTER TABLE public."Phase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Expenses" ENABLE ROW LEVEL SECURITY;

-- 5. Create Strict Isolation Policies
CREATE POLICY "Strict isolation Phase" ON public."Phase" FOR ALL USING (public.can_access_data(user_id)) WITH CHECK (public.can_access_data(user_id));
CREATE POLICY "Strict isolation Category" ON public."Category" FOR ALL USING (public.can_access_data(user_id)) WITH CHECK (public.can_access_data(user_id));
CREATE POLICY "Strict isolation Payee" ON public."Payee" FOR ALL USING (public.can_access_data(user_id)) WITH CHECK (public.can_access_data(user_id));
CREATE POLICY "Strict isolation Product" ON public."Product" FOR ALL USING (public.can_access_data("user")) WITH CHECK (public.can_access_data("user"));
CREATE POLICY "Strict isolation Order" ON public."Order" FOR ALL USING (public.can_access_data(user_id)) WITH CHECK (public.can_access_data(user_id));
CREATE POLICY "Strict isolation Expenses" ON public."Expenses" FOR ALL USING (public.can_access_data(user_id)) WITH CHECK (public.can_access_data(user_id));

CREATE POLICY "Strict isolation OrderItem" ON public."OrderItem" FOR ALL 
USING (EXISTS (SELECT 1 FROM public."Order" o WHERE o.id = "OrderItem".order_id AND public.can_access_data(o.user_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public."Order" o WHERE o.id = "OrderItem".order_id AND public.can_access_data(o.user_id)));

CREATE POLICY "Strict isolation OrderPayment" ON public."OrderPayment" FOR ALL 
USING (EXISTS (SELECT 1 FROM public."Order" o WHERE o.id = "OrderPayment".order_id AND public.can_access_data(o.user_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public."Order" o WHERE o.id = "OrderPayment".order_id AND public.can_access_data(o.user_id)));


-- ==========================================
-- fix_rls_recursion.sql
-- ==========================================

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


-- ==========================================
-- workspace_switching.sql
-- ==========================================

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


-- ==========================================
-- update_rls_shared_team.sql
-- ==========================================

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


-- ==========================================
-- storage_policies.sql
-- ==========================================

-- Drop old policies if any exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Give full access to authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to files" ON storage.objects;

-- 1. Allow any logged-in user to upload, update, delete files in ap_system bucket
CREATE POLICY "Give full access to authenticated users" 
ON storage.objects 
FOR ALL 
TO authenticated 
USING (bucket_id = 'ap_system') 
WITH CHECK (bucket_id = 'ap_system');

-- 2. Allow anyone to view/download files in ap_system bucket
CREATE POLICY "Give public access to files" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'ap_system');


-- ==========================================
-- fix_team_member_visibility.sql
-- ==========================================

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




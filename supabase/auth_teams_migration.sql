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

-- Category Table — add user_id for per-user isolation
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

-- Payee Table (shared resource — all authenticated users can manage)
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

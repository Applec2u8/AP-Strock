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

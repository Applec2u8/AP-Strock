-- ============================================================
-- AP-Strock : FULL DATABASE SETUP (v2 — Fresh Install)
-- ============================================================
-- วิธีใช้: รันไฟล์นี้ทั้งหมดใน Supabase SQL Editor
-- สร้างจากการสังเคราะห์ไฟล์ migration ทั้งหมดในโปรเจกต์:
--   setup.sql / auth_teams_migration.sql / strict_user_isolation.sql
--   fix_rls_recursion.sql / workspace_switching.sql
--   update_rls_shared_team.sql / fix_product_trigger.sql
--   fix_team_member_visibility.sql / storage_policies.sql
-- ============================================================



-- ============================================================
-- SECTION 1: TABLES & FOREIGN KEY RELATIONS
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1.1  users
--      ▸ เชื่อมกับ auth.users ผ่าน auth_id (uuid)
--      ▸ active_workspace_id ใช้สำหรับ Workspace Switching
--        (self-reference → ชี้ไปยัง user อื่นที่เป็น workspace owner)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                   bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  auth_id              uuid   UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email                text   UNIQUE,
  fullname             text,
  tel                  text,
  active_workspace_id  bigint,   -- FK added after table creation (self-ref)
  created_at           timestamp with time zone DEFAULT now()
);

-- Self-referencing FK: active_workspace_id → users(id)
ALTER TABLE public.users
  ADD CONSTRAINT users_active_workspace_id_fkey
  FOREIGN KEY (active_workspace_id)
  REFERENCES public.users(id) ON DELETE SET NULL
  NOT VALID;

-- ──────────────────────────────────────────────────────────
-- 1.2  teams
--      ▸ แต่ละ user จะมี 1 team เป็นของตัวเอง (สร้างอัตโนมัติ)
--      ▸ owner_id → users(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       text,
  owner_id   bigint REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 1.3  team_members
--      ▸ Composite PK (team_id, user_id)
--      ▸ role: 'owner' | 'member'
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id    bigint REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    bigint REFERENCES public.users(id) ON DELETE CASCADE,
  role       text DEFAULT 'member',
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ──────────────────────────────────────────────────────────
-- 1.4  Phase
--      ▸ แต่ละ phase คือรอบการขาย (เฟส)
--      ▸ status: 'active' | 'closed'
--      ▸ user_id → ผู้สร้างเฟส (ใช้สำหรับ RLS isolation)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Phase" (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  phase_name  text NOT NULL,
  status      text CHECK (status IN ('active', 'closed')),
  user_id     bigint REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 1.5  Category
--      ▸ หมวดหมู่สินค้า
--      ▸ user_id → เจ้าของ (ใช้สำหรับ RLS per-user isolation)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Category" (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       text NOT NULL,
  user_id    bigint REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 1.6  Payee
--      ▸ รายชื่อผู้จ่ายเงิน / ผู้รับเงิน
--      ▸ user_id → เจ้าของ (RLS per-user isolation)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Payee" (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       text NOT NULL,
  user_id    bigint REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 1.7  Product
--      ▸ ข้อมูลสินค้า (stock management)
--      ▸ "user"    → ผู้สร้างสินค้า (ตั้งใจใช้ชื่อ "user" ไม่ใช่ user_id
--                   เพื่อ Supabase JS FK join via .select('user(*)'))
--      ▸ cate_id   → Category
--      ▸ phase_id  → Phase
--      ▸ is_archived → soft delete / archive flag
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Product" (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pro_img     text,
  pro_name    text NOT NULL,
  sku         text,
  quantity    integer DEFAULT 0,   -- จำนวนทั้งหมดที่เคยนำเข้า
  qty_sale    integer DEFAULT 0,   -- จำนวนที่ขายแล้ว
  qty_stock   integer DEFAULT 0,   -- จำนวนคงเหลือใน stock
  cost_price  numeric,
  sell_price  numeric,
  cate_id     bigint REFERENCES public."Category"(id) ON DELETE SET NULL,
  "user"      bigint REFERENCES public.users(id) ON DELETE SET NULL,
  phase_id    bigint REFERENCES public."Phase"(id) ON DELETE CASCADE,
  is_archived boolean DEFAULT false,
  created_at  timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 1.8  Order
--      ▸ ใบสั่งซื้อ
--      ▸ address เก็บเป็น JSONB (field: name, ...)
--      ▸ pm_type  → ประเภทการชำระเงิน
--      ▸ delivery_confirmed → 'true' | 'false' (text)
--      ▸ payee    → FK ไปยัง Payee table
--      ▸ order    → เลขที่ออเดอร์ (running number)
--      ▸ user_id  → ผู้สร้าง order (RLS)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Order" (
  id                  bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pm_type             text,
  sale_price          numeric,
  address             jsonb,
  total_qty           integer,
  delivery_confirmed  text DEFAULT 'false',
  promotion           text,
  payee               bigint REFERENCES public."Payee"(id) ON DELETE SET NULL,
  user_id             bigint REFERENCES public.users(id) ON DELETE SET NULL,
  "order"             integer,
  phase_id            bigint REFERENCES public."Phase"(id) ON DELETE CASCADE,
  created_at          timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 1.9  OrderItem
--      ▸ รายการสินค้าในแต่ละออเดอร์
--      ▸ ไม่มี user_id (ใช้ join กับ Order สำหรับ RLS)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."OrderItem" (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id   bigint REFERENCES public."Order"(id) ON DELETE CASCADE,
  pro_id     bigint REFERENCES public."Product"(id) ON DELETE SET NULL,
  qty        integer DEFAULT 1,
  price      numeric,
  phase_id   bigint REFERENCES public."Phase"(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 1.10  OrderPayment
--       ▸ บันทึกการชำระเงินของแต่ละ Order (รองรับชำระแบ่งงวด)
--       ▸ ไม่มี user_id (ใช้ join กับ Order สำหรับ RLS)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."OrderPayment" (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id   bigint REFERENCES public."Order"(id) ON DELETE CASCADE,
  amount     numeric NOT NULL,
  payee      text NOT NULL,
  pm_type    text,
  created_at timestamp with time zone DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 1.11  Expenses
--       ▸ บันทึกค่าใช้จ่ายต่างๆ
--       ▸ payee_id → Payee table (FK)
--       ▸ user_id  → ผู้บันทึก (RLS)
--       ▸ phase_id → ผูกกับเฟสปัจจุบัน
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Expenses" (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  description text NOT NULL,
  amount      numeric NOT NULL,
  category    text,
  date        date,
  phase_id    bigint REFERENCES public."Phase"(id) ON DELETE CASCADE,
  payee_id    bigint REFERENCES public."Payee"(id) ON DELETE SET NULL,
  user_id     bigint REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamp with time zone DEFAULT now()
);



-- ============================================================
-- SECTION 2: INDEXES & PERFORMANCE
-- ============================================================

-- users: lookup by auth_id (ใช้บ่อยมากใน get_current_user_id)
CREATE INDEX IF NOT EXISTS idx_users_auth_id
  ON public.users (auth_id);

-- users: lookup by email (ใช้ใน TeamManagement invite flow)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON public.users (email);

-- Phase: filter by status='active' (ใช้ทุก query ที่ join Phase)
CREATE INDEX IF NOT EXISTS idx_phase_status
  ON public."Phase" (status);

-- Phase: filter by user_id (RLS policy)
CREATE INDEX IF NOT EXISTS idx_phase_user_id
  ON public."Phase" (user_id);

-- Product: filter by phase_id (Product listing query)
CREATE INDEX IF NOT EXISTS idx_product_phase_id
  ON public."Product" (phase_id);

-- Product: filter is_archived (soft delete)
CREATE INDEX IF NOT EXISTS idx_product_is_archived
  ON public."Product" (is_archived);

-- Product: filter by cate_id (category filter)
CREATE INDEX IF NOT EXISTS idx_product_cate_id
  ON public."Product" (cate_id);

-- Product: "user" column for RLS
CREATE INDEX IF NOT EXISTS idx_product_user
  ON public."Product" ("user");

-- Order: filter by phase_id (Order listing)
CREATE INDEX IF NOT EXISTS idx_order_phase_id
  ON public."Order" (phase_id);

-- Order: user_id for RLS
CREATE INDEX IF NOT EXISTS idx_order_user_id
  ON public."Order" (user_id);

-- OrderItem: lookup by order_id (JOIN in Order detail)
CREATE INDEX IF NOT EXISTS idx_orderitem_order_id
  ON public."OrderItem" (order_id);

-- OrderPayment: lookup by order_id
CREATE INDEX IF NOT EXISTS idx_orderpayment_order_id
  ON public."OrderPayment" (order_id);

-- Expenses: filter by phase_id
CREATE INDEX IF NOT EXISTS idx_expenses_phase_id
  ON public."Expenses" (phase_id);

-- Expenses: user_id for RLS
CREATE INDEX IF NOT EXISTS idx_expenses_user_id
  ON public."Expenses" (user_id);

-- team_members: lookup by user_id (ใช้บ่อยใน can_access_data)
CREATE INDEX IF NOT EXISTS idx_team_members_user_id
  ON public.team_members (user_id);

-- team_members: lookup by team_id
CREATE INDEX IF NOT EXISTS idx_team_members_team_id
  ON public.team_members (team_id);

-- teams: lookup by owner_id
CREATE INDEX IF NOT EXISTS idx_teams_owner_id
  ON public.teams (owner_id);



-- ============================================================
-- SECTION 3: DATABASE FUNCTIONS, TRIGGERS & STORED PROCEDURES
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 3.1  get_current_user_id()
--      ▸ ดึง public.users.id ของ user ที่ login อยู่
--      ▸ ใช้ใน RLS policies และ functions อื่นๆ
--      ▸ SECURITY DEFINER → bypass RLS เพื่อ read users table
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS bigint AS $$
DECLARE
  uid bigint;
BEGIN
  SELECT id INTO uid
  FROM public.users
  WHERE auth_id = auth.uid();
  RETURN uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 3.2  is_team_member(check_team_id, check_user_id)
--      ▸ ตรวจสอบว่า user เป็นสมาชิกของทีมหรือไม่
--      ▸ SECURITY DEFINER → ป้องกัน RLS recursion บน team_members
--      ▸ ใช้ใน RLS policy ของ teams และ team_members
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_team_member(check_team_id bigint, check_user_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = check_team_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 3.3  is_team_owner(check_team_id, check_user_id)
--      ▸ ตรวจสอบว่า user เป็น owner ของทีมหรือไม่
--      ▸ SECURITY DEFINER → ป้องกัน RLS recursion บน teams
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_team_owner(check_team_id bigint, check_user_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = check_team_id AND owner_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 3.4  can_access_data(data_owner_id)
--      ▸ ฟังก์ชันหลักสำหรับ RLS บนตาราง data ทั้งหมด
--        (Phase, Category, Payee, Product, Order, Expenses)
--      ▸ Logic (เวอร์ชันล่าสุด — update_rls_shared_team.sql):
--        • ถ้า data_owner_id = current_uid → true (เจ้าของเอง)
--        • ถ้า share team ร่วมกัน → true (เห็น data ของ teammate)
--      ▸ รองรับ Workspace Switching:
--        user ที่ switch ไปยัง team workspace จะเห็นข้อมูลของ
--        workspace owner ได้ผ่าน active_workspace_id
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_access_data(data_owner_id bigint)
RETURNS boolean AS $$
DECLARE
  current_uid bigint;
  has_access  boolean;
BEGIN
  current_uid := public.get_current_user_id();

  -- ตรวจสอบว่าเป็นเจ้าของข้อมูลเอง
  IF data_owner_id = current_uid THEN
    RETURN true;
  END IF;

  -- ตรวจสอบว่า data_owner และ current_user อยู่ใน team เดียวกัน
  -- (ทำให้สมาชิก team เห็นข้อมูลของกันและกันได้)
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = data_owner_id AND tm2.user_id = current_uid
  ) INTO has_access;

  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 3.5  set_workspace_user_id()
--      ▸ Trigger function สำหรับ Phase, Category, Order, Expenses
--      ▸ Auto-set user_id บน INSERT ตาม active_workspace_id
--        ของ user ที่กำลัง insert
--      ▸ ถ้า active_workspace_id != NULL → ใช้ workspace นั้น
--        ถ้า NULL → ใช้ current_uid (personal workspace)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_workspace_user_id()
RETURNS trigger AS $$
DECLARE
  active_ws_id bigint;
  current_uid  bigint;
BEGIN
  current_uid := public.get_current_user_id();

  SELECT active_workspace_id INTO active_ws_id
  FROM public.users
  WHERE id = current_uid;

  -- ถ้ามี active workspace (team workspace) ให้ใช้
  IF active_ws_id IS NOT NULL THEN
    NEW.user_id := active_ws_id;
  ELSE
    NEW.user_id := current_uid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 3.6  set_workspace_user_id_product()
--      ▸ Trigger function เฉพาะสำหรับ Product table
--      ▸ เหมือน set_workspace_user_id แต่เซ็ต "user" column
--        แทน user_id (Product ใช้ column ชื่อ "user")
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_workspace_user_id_product()
RETURNS trigger AS $$
DECLARE
  active_ws_id bigint;
  current_uid  bigint;
BEGIN
  current_uid := public.get_current_user_id();

  SELECT active_workspace_id INTO active_ws_id
  FROM public.users
  WHERE id = current_uid;

  IF active_ws_id IS NOT NULL THEN
    NEW."user" := active_ws_id;
  ELSE
    NEW."user" := current_uid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 3.7  handle_new_user()
--      ▸ Trigger บน auth.users — ทำงานทุกครั้งที่มี signup
--      ▸ สร้าง public.users + teams + team_members อัตโนมัติ
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_user_id bigint;
  new_team_id bigint;
BEGIN
  -- สร้าง row ใน public.users
  INSERT INTO public.users (auth_id, email, fullname)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  RETURNING id INTO new_user_id;

  -- สร้าง default team สำหรับ user นี้
  INSERT INTO public.teams (name, owner_id)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'My Team'),
    new_user_id
  )
  RETURNING id INTO new_team_id;

  -- เพิ่ม user เป็น owner ของ team ตัวเอง
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team_id, new_user_id, 'owner');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- 3.8  Triggers
-- ──────────────────────────────────────────────────────────

-- Trigger: สร้าง user profile อัตโนมัติเมื่อ signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger: auto-set user_id บน Phase INSERT
DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Phase";
CREATE TRIGGER trg_set_workspace_user_id
  BEFORE INSERT ON public."Phase"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_user_id();

-- Trigger: auto-set user_id บน Category INSERT
DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Category";
CREATE TRIGGER trg_set_workspace_user_id
  BEFORE INSERT ON public."Category"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_user_id();

-- Trigger: auto-set user_id บน Order INSERT
DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Order";
CREATE TRIGGER trg_set_workspace_user_id
  BEFORE INSERT ON public."Order"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_user_id();

-- Trigger: auto-set user_id บน Expenses INSERT
DROP TRIGGER IF EXISTS trg_set_workspace_user_id ON public."Expenses";
CREATE TRIGGER trg_set_workspace_user_id
  BEFORE INSERT ON public."Expenses"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_user_id();

-- Trigger: auto-set "user" บน Product INSERT (ใช้ function พิเศษ)
DROP TRIGGER IF EXISTS trg_set_workspace_user_id_product ON public."Product";
CREATE TRIGGER trg_set_workspace_user_id_product
  BEFORE INSERT ON public."Product"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_user_id_product();



-- ============================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 4.1  users table
--      • SELECT: authenticated ทุกคนอ่านได้ (ต้องการสำหรับ
--               team invite & workspace switching)
--      • UPDATE: อัปเดตได้เฉพาะ record ของตัวเอง
-- ──────────────────────────────────────────────────────────
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
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- 4.2  teams table
--      • SELECT: เห็นได้เฉพาะทีมที่ตัวเองอยู่
--      • INSERT: owner_id ต้องเป็น current user
--      • UPDATE/DELETE: เฉพาะ owner เท่านั้น
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view teams they are part of" ON public.teams;
CREATE POLICY "Users can view teams they are part of"
  ON public.teams
  FOR SELECT
  USING (
    owner_id = public.get_current_user_id()
    OR public.is_team_member(id, public.get_current_user_id())
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

-- ──────────────────────────────────────────────────────────
-- 4.3  team_members table
--      • SELECT: สมาชิกทุกคนในทีมเห็นสมาชิกคนอื่นได้ทั้งหมด
--               (แก้ปัญหา: เดิมเห็นได้แค่ row ของตัวเอง)
--      • ALL: เฉพาะ team owner จัดการสมาชิกได้
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
CREATE POLICY "Users can view team members of their teams"
  ON public.team_members
  FOR SELECT
  USING (
    -- สมาชิกคนไหนก็ตามในทีมนี้ เห็นทุก row ในทีมเดียวกันได้
    public.is_team_member(team_id, public.get_current_user_id())
  );

DROP POLICY IF EXISTS "Team owners can manage team members" ON public.team_members;
CREATE POLICY "Team owners can manage team members"
  ON public.team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.owner_id = public.get_current_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────
-- 4.4  Phase table
--      • ALL: ใช้ can_access_data(user_id) — เห็นเฉพาะ phase
--             ของตัวเองหรือ teammate
-- ──────────────────────────────────────────────────────────
ALTER TABLE public."Phase" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Phase isolation by workspace" ON public."Phase";
CREATE POLICY "Phase isolation by workspace"
  ON public."Phase"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));

-- ──────────────────────────────────────────────────────────
-- 4.5  Category table
--      • ALL: ใช้ can_access_data(user_id)
-- ──────────────────────────────────────────────────────────
ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Category isolation by workspace" ON public."Category";
CREATE POLICY "Category isolation by workspace"
  ON public."Category"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));

-- ──────────────────────────────────────────────────────────
-- 4.6  Payee table
--      • ALL: ใช้ can_access_data(user_id) — เห็น payees ของ
--             ตัวเองหรือ teammate เท่านั้น
-- ──────────────────────────────────────────────────────────
ALTER TABLE public."Payee" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payee isolation by workspace" ON public."Payee";
CREATE POLICY "Payee isolation by workspace"
  ON public."Payee"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));

-- ──────────────────────────────────────────────────────────
-- 4.7  Product table
--      • ALL: ใช้ can_access_data("user") — สังเกตว่า column
--             ชื่อ "user" ไม่ใช่ user_id
-- ──────────────────────────────────────────────────────────
ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Product isolation by workspace" ON public."Product";
CREATE POLICY "Product isolation by workspace"
  ON public."Product"
  FOR ALL
  USING (public.can_access_data("user"))
  WITH CHECK (public.can_access_data("user"));

-- ──────────────────────────────────────────────────────────
-- 4.8  Order table
--      • ALL: ใช้ can_access_data(user_id)
-- ──────────────────────────────────────────────────────────
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order isolation by workspace" ON public."Order";
CREATE POLICY "Order isolation by workspace"
  ON public."Order"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));

-- ──────────────────────────────────────────────────────────
-- 4.9  OrderItem table
--      • ไม่มี user_id — ใช้ subquery JOIN กับ Order แทน
--      • ALL: เห็นได้ถ้า order ที่ item นี้อยู่ ผ่าน can_access_data
-- ──────────────────────────────────────────────────────────
ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OrderItem isolation via Order" ON public."OrderItem";
CREATE POLICY "OrderItem isolation via Order"
  ON public."OrderItem"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."Order" o
      WHERE o.id = "OrderItem".order_id
        AND public.can_access_data(o.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Order" o
      WHERE o.id = "OrderItem".order_id
        AND public.can_access_data(o.user_id)
    )
  );

-- ──────────────────────────────────────────────────────────
-- 4.10  OrderPayment table
--       • ไม่มี user_id — ใช้ subquery JOIN กับ Order แทน
-- ──────────────────────────────────────────────────────────
ALTER TABLE public."OrderPayment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OrderPayment isolation via Order" ON public."OrderPayment";
CREATE POLICY "OrderPayment isolation via Order"
  ON public."OrderPayment"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."Order" o
      WHERE o.id = "OrderPayment".order_id
        AND public.can_access_data(o.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Order" o
      WHERE o.id = "OrderPayment".order_id
        AND public.can_access_data(o.user_id)
    )
  );

-- ──────────────────────────────────────────────────────────
-- 4.11  Expenses table
--       • ALL: ใช้ can_access_data(user_id)
-- ──────────────────────────────────────────────────────────
ALTER TABLE public."Expenses" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Expenses isolation by workspace" ON public."Expenses";
CREATE POLICY "Expenses isolation by workspace"
  ON public."Expenses"
  FOR ALL
  USING (public.can_access_data(user_id))
  WITH CHECK (public.can_access_data(user_id));



-- ============================================================
-- SECTION 5: STORAGE BUCKET & POLICIES
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 5.1  สร้าง Storage Bucket: ap_system
--      ▸ public = true → ไฟล์เข้าถึงได้โดยไม่ต้อง auth
--        (ใช้สำหรับ product images — pro_img column)
-- ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('ap_system', 'ap_system', true)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 5.2  Storage Policies บน storage.objects
-- ──────────────────────────────────────────────────────────

-- ล้าง policy เก่าก่อน (ป้องกัน conflict)
DROP POLICY IF EXISTS "Public Access"                           ON storage.objects;
DROP POLICY IF EXISTS "Insert Access"                           ON storage.objects;
DROP POLICY IF EXISTS "Give full access to authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to files"             ON storage.objects;

-- Policy 1: authenticated user อัปโหลด/แก้ไข/ลบไฟล์ได้
CREATE POLICY "Give full access to authenticated users"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'ap_system')
  WITH CHECK (bucket_id = 'ap_system');

-- Policy 2: public (ไม่ต้อง login) ดูไฟล์ได้
CREATE POLICY "Give public access to files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'ap_system');



-- ============================================================
-- SETUP COMPLETE
-- ============================================================
-- ตารางที่สร้างทั้งหมด:
--   public.users           — ข้อมูลผู้ใช้ + workspace switching
--   public.teams           — ทีม (สร้างอัตโนมัติเมื่อ signup)
--   public.team_members    — สมาชิกทีม
--   public."Phase"         — รอบการขาย (เฟส)
--   public."Category"      — หมวดหมู่สินค้า
--   public."Payee"         — รายชื่อผู้จ่ายเงิน
--   public."Product"       — สินค้า
--   public."Order"         — ออเดอร์
--   public."OrderItem"     — รายการสินค้าในออเดอร์
--   public."OrderPayment"  — การชำระเงิน
--   public."Expenses"      — ค่าใช้จ่าย
--
-- Functions:
--   get_current_user_id()              — ดึง user id จาก auth session
--   is_team_member(team_id, user_id)   — ตรวจสอบสมาชิกทีม (ป้องกัน recursion)
--   is_team_owner(team_id, user_id)    — ตรวจสอบ owner ทีม (ป้องกัน recursion)
--   can_access_data(owner_id)          — RLS core logic (shared team access)
--   set_workspace_user_id()            — trigger: auto-set user_id
--   set_workspace_user_id_product()    — trigger: auto-set "user" (Product)
--   handle_new_user()                  — trigger: สร้าง profile เมื่อ signup
--
-- Storage: ap_system bucket (public read, authenticated write)
-- ============================================================

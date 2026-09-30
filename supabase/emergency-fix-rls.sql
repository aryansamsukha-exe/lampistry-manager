-- ============================================================
-- EMERGENCY FIX: Restore products visibility on ProductMaster
-- Run this in Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Step 1: Make sure RLS is enabled on both tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on products so we start clean
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'products' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.products';
  END LOOP;
END $$;

-- Step 3: Drop ALL existing policies on product_images
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'product_images' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.product_images';
  END LOOP;
END $$;

-- Step 4: Create the correct policies
-- Authenticated users can see and manage their OWN products
CREATE POLICY "Users manage own products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Authenticated users can see and manage their OWN product images
CREATE POLICY "Users manage own product images"
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Step 5: Verify — this should list all current policies
SELECT tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'product_images')
ORDER BY tablename, policyname;

-- Step 6: Verify — this should show all products + their owner
SELECT p.user_id, COUNT(*) AS product_count
FROM public.products p
GROUP BY p.user_id;

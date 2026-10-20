-- Showroom collections: products placed in other clients' showrooms, with their own
-- photos and prices for printed price cards. Kept apart from public.products so they
-- never appear in the product list, catalogues, QR pages or print tags.
-- Safe to re-run. Apply in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.showroom_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  client_name TEXT CHECK (client_name IS NULL OR length(client_name) <= 120),
  source_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.showroom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.showroom_collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  product_code TEXT,
  description TEXT,
  finish TEXT,
  length TEXT,
  width TEXT,
  height TEXT,
  price NUMERIC(12, 2) CHECK (price IS NULL OR price >= 0),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS showroom_collections_user_created_idx
  ON public.showroom_collections(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS showroom_items_collection_order_idx
  ON public.showroom_items(collection_id, sort_order);

ALTER TABLE public.showroom_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showroom_items ENABLE ROW LEVEL SECURITY;

-- Owner-only, like products and catalogs. No anon access: prices stay private.
DROP POLICY IF EXISTS "Users manage own showroom collections" ON public.showroom_collections;
CREATE POLICY "Users manage own showroom collections" ON public.showroom_collections
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own showroom items" ON public.showroom_items;
CREATE POLICY "Users manage own showroom items" ON public.showroom_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.showroom_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
  );

REVOKE ALL ON public.showroom_collections, public.showroom_items FROM anon;

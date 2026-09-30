-- ProductMaster catalog upgrade. Apply once in the Supabase SQL editor.
-- This is backward compatible: existing products keep a NULL import_batch_id.

CREATE TABLE IF NOT EXISTS public.product_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  source_file_name TEXT,
  product_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS import_batch_id UUID
  REFERENCES public.product_import_batches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  import_batch_id UUID REFERENCES public.product_import_batches(id) ON DELETE SET NULL,
  layout TEXT NOT NULL DEFAULT '2',
  cover_title TEXT,
  cover_subtitle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(catalog_id, product_id)
);

CREATE INDEX IF NOT EXISTS products_import_batch_id_idx ON public.products(import_batch_id);
CREATE INDEX IF NOT EXISTS import_batches_user_created_idx ON public.product_import_batches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catalogs_user_created_idx ON public.catalogs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_products_catalog_order_idx ON public.catalog_products(catalog_id, sort_order);

ALTER TABLE public.product_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own import batches" ON public.product_import_batches;
CREATE POLICY "Users manage own import batches" ON public.product_import_batches
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own catalogs" ON public.catalogs;
CREATE POLICY "Users manage own catalogs" ON public.catalogs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own catalog products" ON public.catalog_products;
CREATE POLICY "Users manage own catalog products" ON public.catalog_products
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = catalog_id AND c.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.catalogs c WHERE c.id = catalog_id AND c.user_id = auth.uid())
  );

-- Public QR access is limited to an exact UUID lookup via this function. It does
-- not make the products or product_images tables broadly readable to anonymous users.
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Public can read product images" ON public.product_images;

CREATE OR REPLACE FUNCTION public.get_public_product(product_uuid UUID)
RETURNS TABLE (
  id UUID, sno INTEGER, product_code TEXT, dimensions TEXT, length TEXT, width TEXT,
  height TEXT, price NUMERIC, cbm TEXT, description TEXT, image_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.sno, p.product_code, p.dimensions, p.length, p.width, p.height,
         p.price, p.cbm, p.description,
         (SELECT pi.image_url FROM public.product_images pi
          WHERE pi.product_code = p.product_code AND pi.user_id = p.user_id
          ORDER BY pi.created_at DESC LIMIT 1)
  FROM public.products p WHERE p.id = product_uuid LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_product(UUID) TO anon, authenticated;

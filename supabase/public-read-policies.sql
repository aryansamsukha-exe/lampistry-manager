-- Allow anonymous QR scans to read products + images (SELECT only).
-- Run in Supabase Dashboard → SQL Editor → Run
-- Keep write policies owner-only; do not grant anon INSERT/UPDATE/DELETE.

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read products" ON public.products;
CREATE POLICY "Public can read products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read product images" ON public.product_images;
CREATE POLICY "Public can read product images"
ON public.product_images
FOR SELECT
TO anon, authenticated
USING (true);

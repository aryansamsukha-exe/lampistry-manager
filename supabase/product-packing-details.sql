-- Adds finish, packing size and net weight to products. Apply once in the Supabase SQL editor.
-- Backward compatible: existing products keep NULL in the new columns.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS finish TEXT,
  ADD COLUMN IF NOT EXISTS packing_length TEXT,
  ADD COLUMN IF NOT EXISTS packing_width TEXT,
  ADD COLUMN IF NOT EXISTS packing_height TEXT,
  ADD COLUMN IF NOT EXISTS net_weight TEXT;

-- The return type changes, so the function has to be dropped before it is recreated.
DROP FUNCTION IF EXISTS public.get_public_product(UUID);

CREATE FUNCTION public.get_public_product(product_uuid UUID)
RETURNS TABLE (
  id UUID, sno INTEGER, product_code TEXT, dimensions TEXT, length TEXT, width TEXT,
  height TEXT, price NUMERIC, cbm TEXT, description TEXT, image_url TEXT,
  finish TEXT, packing_length TEXT, packing_width TEXT, packing_height TEXT, net_weight TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.sno, p.product_code, p.dimensions, p.length, p.width, p.height,
         p.price, p.cbm, p.description,
         (SELECT pi.image_url FROM public.product_images pi
          WHERE pi.product_code = p.product_code AND pi.user_id = p.user_id
          ORDER BY pi.created_at DESC LIMIT 1),
         p.finish, p.packing_length, p.packing_width, p.packing_height, p.net_weight
  FROM public.products p WHERE p.id = product_uuid LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_product(UUID) TO anon, authenticated;

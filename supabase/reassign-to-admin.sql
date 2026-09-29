-- Reassign all products + images to admin@gmail.com
-- admin UID: 149e2c7f-6acd-44af-85ae-ab8486a2e0f4
-- Run this in Supabase Dashboard → SQL Editor → New query → Run

DO $$
DECLARE
  admin_id uuid := '149e2c7f-6acd-44af-85ae-ab8486a2e0f4';
BEGIN
  -- If the same product_code exists under multiple users, keep one row then reassign
  DELETE FROM public.products p
  USING public.products keep
  WHERE p.product_code = keep.product_code
    AND p.id <> keep.id
    AND p.created_at < keep.created_at;

  DELETE FROM public.product_images pi
  USING public.product_images keep
  WHERE pi.product_code = keep.product_code
    AND pi.id <> keep.id
    AND pi.created_at < keep.created_at;

  UPDATE public.products
  SET user_id = admin_id
  WHERE user_id IS DISTINCT FROM admin_id;

  UPDATE public.product_images
  SET user_id = admin_id
  WHERE user_id IS DISTINCT FROM admin_id;
END $$;

-- Verify ownership
SELECT 'products' AS table_name, user_id, count(*) AS rows
FROM public.products
GROUP BY user_id
UNION ALL
SELECT 'product_images', user_id, count(*)
FROM public.product_images
GROUP BY user_id;

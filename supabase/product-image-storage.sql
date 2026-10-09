-- Stores product photos as files in Supabase Storage instead of base64 text in product_images.
-- Apply once in the Supabase SQL editor. product_images.image_url then holds a short public URL.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Files live under "<user id>/..." and only their owner can add, replace or remove them.
-- Reading is public (QR pages are opened by anonymous visitors).
DROP POLICY IF EXISTS "Users read own product image files" ON storage.objects;
CREATE POLICY "Users read own product image files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users upload own product image files" ON storage.objects;
CREATE POLICY "Users upload own product image files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own product image files" ON storage.objects;
CREATE POLICY "Users update own product image files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own product image files" ON storage.objects;
CREATE POLICY "Users delete own product image files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

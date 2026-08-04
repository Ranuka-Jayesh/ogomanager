-- Migration: expense product logo / image
-- Run in Supabase SQL editor

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

COMMENT ON COLUMN expenses.image_url IS 'Public URL of product logo stored in expense-logos bucket';

-- Storage bucket (public read for logos on expense cards)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-logos',
  'expense-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies: anon/authenticated can upload, update, delete, and read
DROP POLICY IF EXISTS "expense_logos_public_read" ON storage.objects;
CREATE POLICY "expense_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'expense-logos');

DROP POLICY IF EXISTS "expense_logos_public_insert" ON storage.objects;
CREATE POLICY "expense_logos_public_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'expense-logos');

DROP POLICY IF EXISTS "expense_logos_public_update" ON storage.objects;
CREATE POLICY "expense_logos_public_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'expense-logos');

DROP POLICY IF EXISTS "expense_logos_public_delete" ON storage.objects;
CREATE POLICY "expense_logos_public_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'expense-logos');

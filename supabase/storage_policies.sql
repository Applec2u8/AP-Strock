-- Drop old policies if any exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Give full access to authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to files" ON storage.objects;

-- 1. Allow any logged-in user to upload, update, delete files in ap_system bucket
CREATE POLICY "Give full access to authenticated users" 
ON storage.objects 
FOR ALL 
TO authenticated 
USING (bucket_id = 'ap_system') 
WITH CHECK (bucket_id = 'ap_system');

-- 2. Allow anyone to view/download files in ap_system bucket
CREATE POLICY "Give public access to files" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'ap_system');

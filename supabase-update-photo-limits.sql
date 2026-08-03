-- Run this in the Supabase SQL Editor to update the server-side photo size
-- limit on the bucket you already created (5 MB -> 10 MB). Safe to run
-- as many times as needed; does not affect existing data or policies.

update storage.buckets
set file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'bin-report-photos';

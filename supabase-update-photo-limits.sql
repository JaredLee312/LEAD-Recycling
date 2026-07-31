-- Run this in the Supabase SQL Editor to add server-side photo validation
-- to the bucket you already created. Safe to run once; does not affect
-- existing data or policies.

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'bin-report-photos';

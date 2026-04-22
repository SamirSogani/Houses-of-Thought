-- Tighten storage.objects INSERT policy on the attachments bucket.
-- All legitimate uploads happen through the `upload-attachment` edge function
-- using the service role (which bypasses RLS). End-users should NOT be able to
-- write directly to the bucket, since direct uploads bypass the parent-ownership
-- check (`can_attach_to`) that the edge function enforces. Replace the
-- permissive policy with one that denies authenticated direct INSERTs.
DROP POLICY IF EXISTS attachments_obj_insert ON storage.objects;

CREATE POLICY attachments_obj_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Defensive: explicitly block all direct INSERTs on classroom_members.
-- Membership creation must go through the join_classroom() SECURITY DEFINER RPC,
-- which enforces one-classroom-per-student + student_cap. SECURITY DEFINER
-- bypasses RLS, so the RPC continues to work.
CREATE POLICY "members_block_direct_insert"
ON public.classroom_members
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);
-- Fix: "infinite recursion detected in policy for relation organization_members"
-- The previous SELECT policy subqueried organization_members, re-entering the same policy.
-- Authenticated users only need their own membership rows for org checks (all other policies
-- use EXISTS (... AND m.user_id = auth.uid()).

DROP POLICY IF EXISTS "Members can view org rosters they belong to" ON public.organization_members;

CREATE POLICY "Members can view org rosters they belong to"
  ON public.organization_members FOR SELECT
  USING (user_id = auth.uid());

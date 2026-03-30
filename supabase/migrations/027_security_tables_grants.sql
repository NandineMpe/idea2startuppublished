-- Ensure authenticated clients can read scan results (RLS still restricts rows to auth.uid() = user_id).
-- Apply after 026_security_updates.sql (tables must exist).

GRANT SELECT ON TABLE public.security_findings TO authenticated;
GRANT SELECT ON TABLE public.security_scans TO authenticated;

-- Idempotent RLS repair (partial migrations may have skipped policies)
ALTER TABLE content_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_preferences_select" ON content_preferences;
DROP POLICY IF EXISTS "content_preferences_insert" ON content_preferences;

CREATE POLICY "content_preferences_select" ON content_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "content_preferences_insert" ON content_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

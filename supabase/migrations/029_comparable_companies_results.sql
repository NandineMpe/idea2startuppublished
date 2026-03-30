-- Async comparable companies jobs (n8n callback updates rows by id)
CREATE TABLE IF NOT EXISTS comparable_companies_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  comparables jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comparable_companies_results_user
  ON comparable_companies_results (user_id, created_at DESC);

ALTER TABLE comparable_companies_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comparable_companies_results"
  ON comparable_companies_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own comparable_companies_results"
  ON comparable_companies_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comparable_companies_results"
  ON comparable_companies_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comparable_companies_results"
  ON comparable_companies_results FOR DELETE USING (auth.uid() = user_id);

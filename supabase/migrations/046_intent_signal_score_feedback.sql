-- Optional subreddit targets for Reddit intent scanning (no r/ prefix). Null = derive per scan from context + defaults.
ALTER TABLE company_profile
ADD COLUMN IF NOT EXISTS reddit_intent_subreddits JSONB DEFAULT NULL;

COMMENT ON COLUMN company_profile.reddit_intent_subreddits IS 'JSON array of subreddit name strings for intent scanning; null uses AI suggestion merged with defaults each run';

-- Workspace profiles table exists only after multitenancy migration (038). Skip if not deployed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'client_workspace_profiles'
  ) THEN
    EXECUTE 'ALTER TABLE client_workspace_profiles ADD COLUMN IF NOT EXISTS reddit_intent_subreddits JSONB DEFAULT NULL';
    EXECUTE 'COMMENT ON COLUMN client_workspace_profiles.reddit_intent_subreddits IS ''JSON array of subreddit name strings for intent scanning; null uses AI suggestion merged with defaults each run''';
  END IF;
END $$;

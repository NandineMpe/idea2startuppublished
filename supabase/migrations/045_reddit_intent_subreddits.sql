-- Optional subreddit targets for Reddit intent scanning (no r/ prefix). Null = derive per scan from context + defaults.
ALTER TABLE company_profile
ADD COLUMN IF NOT EXISTS reddit_intent_subreddits JSONB DEFAULT NULL;

COMMENT ON COLUMN company_profile.reddit_intent_subreddits IS 'JSON array of subreddit name strings for intent scanning; null uses AI suggestion merged with defaults each run';

ALTER TABLE client_workspace_profiles
ADD COLUMN IF NOT EXISTS reddit_intent_subreddits JSONB DEFAULT NULL;

COMMENT ON COLUMN client_workspace_profiles.reddit_intent_subreddits IS 'JSON array of subreddit name strings for intent scanning; null uses AI suggestion merged with defaults each run';

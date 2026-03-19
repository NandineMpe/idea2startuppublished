-- ============================================================
-- IdeaToStartup – Initial Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension (already on by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: chat_sessions
-- One session per conversation thread in Juno chat
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: chat_messages
-- Every message in every Juno chat session
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: ai_outputs
-- Saved outputs from all AI tools (roadmaps, pitches, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,          -- e.g. 'roadmap', 'value-proposition', 'business-model'
  title TEXT NOT NULL,         -- user-provided or auto-generated title
  inputs JSONB,                -- the form inputs that generated this output
  output TEXT NOT NULL,        -- the AI-generated text
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: user_feedback
-- Replaces the in-memory feedbackStore in /api/feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT,                 -- e.g. 'customer interview', 'survey', 'support'
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  content TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Each user can only see and modify their own data
-- ============================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- chat_sessions policies
CREATE POLICY "Users can view own chat sessions"
  ON chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat sessions"
  ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat sessions"
  ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat sessions"
  ON chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- chat_messages policies
CREATE POLICY "Users can view own messages"
  ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages"
  ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- ai_outputs policies
CREATE POLICY "Users can view own outputs"
  ON ai_outputs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own outputs"
  ON ai_outputs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own outputs"
  ON ai_outputs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own outputs"
  ON ai_outputs FOR DELETE USING (auth.uid() = user_id);

-- user_feedback policies
CREATE POLICY "Users can view own feedback"
  ON user_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback"
  ON user_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own feedback"
  ON user_feedback FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_user_id ON ai_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_tool ON ai_outputs(tool);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);

-- ============================================================
-- Auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_ai_outputs_updated_at
  BEFORE UPDATE ON ai_outputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

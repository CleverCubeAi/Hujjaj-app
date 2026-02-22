-- Migration 006: User Preferences Table
-- Optional table for storing user preferences in database
-- Alternative: Use localStorage in frontend

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT DEFAULT 'ar',
  theme TEXT DEFAULT 'light',
  notifications_email BOOLEAN DEFAULT true,
  notifications_sms BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage own preferences
CREATE POLICY "Users can manage own preferences" ON user_preferences
FOR ALL USING (user_id = auth.uid());

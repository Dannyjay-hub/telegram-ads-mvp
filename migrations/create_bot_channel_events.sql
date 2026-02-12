-- Migration: Create bot_channel_events table
-- Stores events when our bot is added/removed from channels
-- Used by the frontend polling flow to auto-detect new channel additions

CREATE TABLE IF NOT EXISTS bot_channel_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    chat_title TEXT,
    chat_username TEXT,
    chat_type TEXT DEFAULT 'channel',
    added_by_user_id BIGINT NOT NULL,
    bot_status TEXT NOT NULL, -- 'administrator', 'member', 'left', 'kicked'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bot_channel_events_user ON bot_channel_events(added_by_user_id, created_at DESC);

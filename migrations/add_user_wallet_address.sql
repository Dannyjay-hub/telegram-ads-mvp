-- Migration: Add wallet_address to users table
-- This allows storing the TON wallet address when users connect via TonConnect

ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_wallet_address TEXT;

-- Index for wallet lookups (case-insensitive since TON addresses can be formatted differently)
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users (ton_wallet_address);

-- Optional: Add a last_wallet_connected_at timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMP WITH TIME ZONE;

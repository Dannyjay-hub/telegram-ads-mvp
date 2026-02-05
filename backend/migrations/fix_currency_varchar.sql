-- Fix: "USDT" is 4 chars but currency columns are varchar(3)
-- This migration increases currency column sizes to accommodate all crypto symbols

-- Deals table: price_currency
ALTER TABLE deals 
ALTER COLUMN price_currency TYPE VARCHAR(10);

-- Channels table: base_price_currency  
ALTER TABLE channels 
ALTER COLUMN base_price_currency TYPE VARCHAR(10);

-- Wallets table: currency
ALTER TABLE wallets 
ALTER COLUMN currency TYPE VARCHAR(10);

-- Public Briefs table: currency
ALTER TABLE public_briefs 
ALTER COLUMN currency TYPE VARCHAR(10);

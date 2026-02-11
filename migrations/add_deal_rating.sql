-- Add rating to deals and cached avg_rating/total_ratings to channels
-- This supports the deal completion rating feature

-- Add rating column to deals (1-5 stars, nullable)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- Add cached rating columns to channels
ALTER TABLE channels ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT NULL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

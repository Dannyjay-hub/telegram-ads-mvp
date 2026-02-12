-- Add 'pending' to deal_status enum for closed campaign applications
-- This was previously commented out in add_escrow_payment_fields.sql
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'draft';

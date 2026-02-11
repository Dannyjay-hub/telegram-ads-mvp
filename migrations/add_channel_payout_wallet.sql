-- Add payout wallet address to channels table
-- This is set by the channel owner during channel listing
-- and used for sending payouts after deal completion
ALTER TABLE public.channels ADD COLUMN payout_wallet text;

-- Comment for documentation
COMMENT ON COLUMN public.channels.payout_wallet IS 'TON wallet address for receiving payouts, set by channel owner during listing';

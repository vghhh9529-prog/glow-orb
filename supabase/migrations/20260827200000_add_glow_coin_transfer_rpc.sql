-- Glow Coin transfers must be atomic: debit, credit, and both ledger rows succeed together.
CREATE OR REPLACE FUNCTION public.transfer_glow_coin(
  p_sender_id text,
  p_recipient_id text,
  p_amount bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_balance bigint;
  recipient_balance bigint;
BEGIN
  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self');
  END IF;

  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000000000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  -- The caller creates these rows first; this keeps a direct RPC call safe too.
  INSERT INTO public.glow_wallets (user_id) VALUES (p_sender_id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.glow_wallets (user_id) VALUES (p_recipient_id) ON CONFLICT (user_id) DO NOTHING;

  -- Lock in a deterministic order to avoid deadlocks when both users transfer concurrently.
  IF p_sender_id < p_recipient_id THEN
    SELECT balance INTO sender_balance FROM public.glow_wallets WHERE user_id = p_sender_id FOR UPDATE;
    SELECT balance INTO recipient_balance FROM public.glow_wallets WHERE user_id = p_recipient_id FOR UPDATE;
  ELSE
    SELECT balance INTO recipient_balance FROM public.glow_wallets WHERE user_id = p_recipient_id FOR UPDATE;
    SELECT balance INTO sender_balance FROM public.glow_wallets WHERE user_id = p_sender_id FOR UPDATE;
  END IF;

  IF sender_balance < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_funds',
      'sender_balance', sender_balance
    );
  END IF;

  UPDATE public.glow_wallets
  SET balance = sender_balance - p_amount, updated_at = now()
  WHERE user_id = p_sender_id;

  UPDATE public.glow_wallets
  SET balance = recipient_balance + p_amount, updated_at = now()
  WHERE user_id = p_recipient_id;

  INSERT INTO public.glow_transactions (user_id, amount, kind, note)
  VALUES
    (p_sender_id, -p_amount, 'transfer_sent', 'Glow Coin transfer to ' || p_recipient_id),
    (p_recipient_id, p_amount, 'transfer_received', 'Glow Coin transfer from ' || p_sender_id);

  RETURN jsonb_build_object(
    'ok', true,
    'amount', p_amount,
    'sender_balance', sender_balance - p_amount,
    'recipient_balance', recipient_balance + p_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_glow_coin(text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_glow_coin(text, text, bigint) TO service_role;

-- Run this in Supabase SQL Editor after applying
-- 20260827200000_add_glow_coin_transfer_rpc.sql

SELECT
  p.oid::regprocedure AS function_signature,
  p.prosecdef AS security_definer,
  has_function_privilege(
    'service_role',
    p.oid,
    'EXECUTE'
  ) AS service_role_can_execute,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'transfer_glow_coin'
  AND pg_get_function_identity_arguments(p.oid) = 'text, text, bigint';

-- Expected: exactly one row, security_definer = true,
-- service_role_can_execute = true, and signature:
-- transfer_glow_coin(text,text,bigint)

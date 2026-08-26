-- Glow Orb — Complete Supabase schema
-- Run this file in the SQL Editor of a NEW Supabase project.
-- It is intentionally self-contained and contains no secrets.
-- The application uses the server-side service_role key; public client roles are denied table access.

BEGIN;

-- Required for gen_random_uuid(). Supabase normally has this extension available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Core Discord identity and web sessions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.discord_users (
  id text PRIMARY KEY,
  username text NOT NULL,
  global_name text,
  avatar text,
  email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.discord_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_sessions_expires_idx
  ON public.app_sessions (expires_at);

CREATE INDEX IF NOT EXISTS discord_users_username_idx
  ON public.discord_users (username);

-- -----------------------------------------------------------------------------
-- Guilds and configurable modules
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guilds (
  id text PRIMARY KEY,
  name text NOT NULL,
  icon text,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  locale text NOT NULL DEFAULT 'ar',
  prefix text NOT NULL DEFAULT '!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guild_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, module)
);

CREATE INDEX IF NOT EXISTS guild_modules_guild_idx
  ON public.guild_modules (guild_id);

CREATE INDEX IF NOT EXISTS guild_modules_enabled_idx
  ON public.guild_modules (guild_id, enabled);

-- Generic item storage used by auto-replies, auto-interactions and future module items.
CREATE TABLE IF NOT EXISTS public.guild_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guild_items_guild_kind_idx
  ON public.guild_items (guild_id, kind);

CREATE INDEX IF NOT EXISTS guild_items_enabled_idx
  ON public.guild_items (guild_id, kind, enabled);

-- -----------------------------------------------------------------------------
-- Suggestions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  author_name text,
  content text NOT NULL,
  image_url text,
  anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suggestions_guild_idx
  ON public.suggestions (guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS suggestions_status_idx
  ON public.suggestions (guild_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS suggestions_author_idx
  ON public.suggestions (guild_id, author_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Scam reports
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_scam_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.scam_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  reporter_id text NOT NULL,
  reporter_name text,
  reported_user_id text NOT NULL,
  reported_username text,
  reported_avatar text,
  description text NOT NULL,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_message_id text,
  review_error text,
  reviewed_by text,
  reviewed_at timestamptz,
  role_assigned boolean NOT NULL DEFAULT false,
  role_assignment_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scam_reports_guild_status_idx
  ON public.scam_reports (guild_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS scam_reports_target_status_idx
  ON public.scam_reports (guild_id, reported_user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS set_scam_reports_updated_at ON public.scam_reports;
CREATE TRIGGER set_scam_reports_updated_at
  BEFORE UPDATE ON public.scam_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_scam_reports_updated_at();

-- Leveling
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.member_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  username text,
  avatar text,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 0,
  daily_xp integer NOT NULL DEFAULT 0,
  weekly_xp integer NOT NULL DEFAULT 0,
  monthly_xp integer NOT NULL DEFAULT 0,
  voice_minutes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS member_levels_rank_idx
  ON public.member_levels (guild_id, xp DESC);

CREATE INDEX IF NOT EXISTS member_levels_level_idx
  ON public.member_levels (guild_id, level DESC, xp DESC);

-- -----------------------------------------------------------------------------
-- Moderation cases
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_id text NOT NULL,
  target_name text,
  target_avatar text,
  moderator_id text,
  moderator_name text,
  reason text,
  duration_minutes integer,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_cases_guild_idx
  ON public.moderation_cases (guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_cases_active_idx
  ON public.moderation_cases (guild_id, active, created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_cases_target_idx
  ON public.moderation_cases (guild_id, target_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Glow economy
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.glow_wallets (
  user_id text PRIMARY KEY REFERENCES public.discord_users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  total_earned bigint NOT NULL DEFAULT 0,
  last_daily_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.glow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.discord_users(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  kind text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS glow_tx_user_idx
  ON public.glow_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS glow_tx_kind_idx
  ON public.glow_transactions (kind, created_at DESC);

-- -----------------------------------------------------------------------------
-- Timestamp maintenance
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_discord_users_updated_at ON public.discord_users;
CREATE TRIGGER set_discord_users_updated_at
  BEFORE UPDATE ON public.discord_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_guilds_updated_at ON public.guilds;
CREATE TRIGGER set_guilds_updated_at
  BEFORE UPDATE ON public.guilds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_guild_modules_updated_at ON public.guild_modules;
CREATE TRIGGER set_guild_modules_updated_at
  BEFORE UPDATE ON public.guild_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_guild_items_updated_at ON public.guild_items;
CREATE TRIGGER set_guild_items_updated_at
  BEFORE UPDATE ON public.guild_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_suggestions_updated_at ON public.suggestions;
CREATE TRIGGER set_suggestions_updated_at
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_member_levels_updated_at ON public.member_levels;
CREATE TRIGGER set_member_levels_updated_at
  BEFORE UPDATE ON public.member_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_glow_wallets_updated_at ON public.glow_wallets;
CREATE TRIGGER set_glow_wallets_updated_at
  BEFORE UPDATE ON public.glow_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Session maintenance helper
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_expired_app_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.app_sessions WHERE expires_at <= now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- Security model
-- -----------------------------------------------------------------------------
-- The web server and bot use Supabase service_role server-side. RLS remains enabled
-- on every application table, while anon/authenticated receive no direct table access.

ALTER TABLE public.discord_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scam_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glow_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glow_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.discord_users,
  public.app_sessions,
  public.guilds,
  public.guild_modules,
  public.guild_items,
  public.suggestions,
  public.scam_reports,
  public.member_levels,
  public.moderation_cases,
  public.glow_wallets,
  public.glow_transactions
FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON TABLE
  public.discord_users,
  public.app_sessions,
  public.guilds,
  public.guild_modules,
  public.guild_items,
  public.suggestions,
  public.scam_reports,
  public.member_levels,
  public.moderation_cases,
  public.glow_wallets,
  public.glow_transactions
TO service_role;

GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_scam_reports_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_expired_app_sessions() TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verification query: should return exactly these 11 public tables.
-- -----------------------------------------------------------------------------

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'discord_users',
    'app_sessions',
    'guilds',
    'guild_modules',
    'guild_items',
    'suggestions',
    'scam_reports',
    'member_levels',
    'moderation_cases',
    'glow_wallets',
    'glow_transactions'
  )
ORDER BY table_name;

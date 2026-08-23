-- Discord users
CREATE TABLE public.discord_users (
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
GRANT ALL ON public.discord_users TO service_role;
ALTER TABLE public.discord_users ENABLE ROW LEVEL SECURITY;

-- Sessions
CREATE TABLE public.app_sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.discord_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_sessions TO service_role;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

-- Guilds
CREATE TABLE public.guilds (
  id text PRIMARY KEY,
  name text NOT NULL,
  icon text,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  locale text NOT NULL DEFAULT 'ar',
  prefix text NOT NULL DEFAULT '!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.guilds TO service_role;
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;

-- Module configs
CREATE TABLE public.guild_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, module)
);
GRANT ALL ON public.guild_modules TO service_role;
ALTER TABLE public.guild_modules ENABLE ROW LEVEL SECURITY;

-- Generic per-guild item lists (auto replies, auto interactions, temp voice hubs, protection rules)
CREATE TABLE public.guild_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guild_items_guild_kind_idx ON public.guild_items (guild_id, kind);
GRANT ALL ON public.guild_items TO service_role;
ALTER TABLE public.guild_items ENABLE ROW LEVEL SECURITY;

-- Suggestions
CREATE TABLE public.suggestions (
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
CREATE INDEX suggestions_guild_idx ON public.suggestions (guild_id, created_at DESC);
GRANT ALL ON public.suggestions TO service_role;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Levels
CREATE TABLE public.member_levels (
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
CREATE INDEX member_levels_rank_idx ON public.member_levels (guild_id, xp DESC);
GRANT ALL ON public.member_levels TO service_role;
ALTER TABLE public.member_levels ENABLE ROW LEVEL SECURITY;

-- Moderation cases
CREATE TABLE public.moderation_cases (
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
CREATE INDEX moderation_cases_guild_idx ON public.moderation_cases (guild_id, created_at DESC);
GRANT ALL ON public.moderation_cases TO service_role;
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;

-- Glow economy
CREATE TABLE public.glow_wallets (
  user_id text PRIMARY KEY REFERENCES public.discord_users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  total_earned bigint NOT NULL DEFAULT 0,
  last_daily_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.glow_wallets TO service_role;
ALTER TABLE public.glow_wallets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.glow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.discord_users(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  kind text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX glow_tx_user_idx ON public.glow_transactions (user_id, created_at DESC);
GRANT ALL ON public.glow_transactions TO service_role;
ALTER TABLE public.glow_transactions ENABLE ROW LEVEL SECURITY;
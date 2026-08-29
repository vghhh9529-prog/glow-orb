ALTER TABLE public.guilds
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invite_url text;

CREATE INDEX IF NOT EXISTS guilds_member_count_idx
  ON public.guilds (member_count DESC);

COMMENT ON COLUMN public.guilds.member_count IS 'Current Discord member count last synchronized by the bot';
COMMENT ON COLUMN public.guilds.invite_url IS 'Persistent Discord invite or vanity URL last synchronized by the bot';

GRANT SELECT, INSERT, UPDATE ON public.guilds TO service_role;

UPDATE public.guilds
SET member_count = COALESCE(member_count, 0)
WHERE member_count IS NULL;

ALTER TABLE public.guilds
  ALTER COLUMN member_count SET DEFAULT 0,
  ALTER COLUMN member_count SET NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Apply this migration once in Supabase SQL Editor for existing installations.

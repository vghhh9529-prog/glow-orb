-- Scam reports: pending reports are reviewed in Discord before appearing in the dashboard list.
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

GRANT ALL ON public.scam_reports TO service_role;
ALTER TABLE public.scam_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scam_reports FROM anon, authenticated;

COMMENT ON TABLE public.scam_reports IS 'User-submitted scam reports reviewed by Discord administrators before publication.';
COMMENT ON COLUMN public.scam_reports.evidence_urls IS 'JSON array of uploaded evidence metadata; image bytes live in Supabase Storage.';

CREATE OR REPLACE FUNCTION public.set_scam_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_scam_reports_updated_at ON public.scam_reports;
CREATE TRIGGER set_scam_reports_updated_at
  BEFORE UPDATE ON public.scam_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_scam_reports_updated_at();

GRANT EXECUTE ON FUNCTION public.set_scam_reports_updated_at() TO service_role;

-- The application creates the public evidence bucket lazily through the service-role client.
-- No storage object policy is granted to anon/authenticated here.

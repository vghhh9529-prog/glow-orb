CREATE TABLE IF NOT EXISTS public.site_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_key text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  body_ar text NOT NULL,
  body_en text NOT NULL,
  href text,
  tone text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_notification_reads (
  notification_id uuid NOT NULL REFERENCES public.site_notifications(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.discord_users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS site_notifications_created_at_idx
  ON public.site_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS site_notification_reads_user_idx
  ON public.site_notification_reads (user_id, read_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.site_notifications TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.site_notification_reads TO service_role;

NOTIFY pgrst, 'reload schema';

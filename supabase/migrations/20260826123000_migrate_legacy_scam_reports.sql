-- Optional compatibility migration for installations that ran the first scam_reports schema.
-- The current application stores new reports in guild_items with kind = scam_reports.
DO $$
DECLARE
  legacy record;
  migrated_data jsonb;
BEGIN
  IF to_regclass('public.scam_reports') IS NULL THEN
    RETURN;
  END IF;

  FOR legacy IN
    SELECT * FROM public.scam_reports
    WHERE status IN ('pending', 'approved', 'rejected')
  LOOP
    migrated_data := jsonb_build_object(
      'sourceGuildId', legacy.guild_id,
      'sourceGuildName', COALESCE((SELECT name FROM public.guilds WHERE id = legacy.guild_id), 'Unknown server'),
      'reporterId', legacy.reporter_id,
      'reporterName', legacy.reporter_name,
      'reportedUserId', legacy.reported_user_id,
      'reportedUsername', legacy.reported_username,
      'reportedAvatar', legacy.reported_avatar,
      'description', legacy.description,
      'evidence', COALESCE(legacy.evidence_urls, '[]'::jsonb),
      'status', legacy.status,
      'reviewMessageId', legacy.review_message_id,
      'reviewError', legacy.review_error,
      'reviewedBy', legacy.reviewed_by,
      'reviewedAt', legacy.reviewed_at,
      'roleAssigned', legacy.role_assigned,
      'roleAssignmentError', legacy.role_assignment_error,
      'createdAt', legacy.created_at
    );

    IF NOT EXISTS (
      SELECT 1 FROM public.guild_items
      WHERE kind = 'scam_reports'
        AND data ->> 'legacyReportId' = legacy.id::text
    ) THEN
      migrated_data := migrated_data || jsonb_build_object('legacyReportId', legacy.id::text);
      INSERT INTO public.guild_items (guild_id, kind, name, enabled, data)
      VALUES (
        legacy.guild_id,
        'scam_reports',
        LEFT('Scam report · ' || COALESCE(legacy.reported_username, legacy.reported_user_id), 100),
        legacy.status = 'approved',
        migrated_data
      );
    END IF;
  END LOOP;
END $$;

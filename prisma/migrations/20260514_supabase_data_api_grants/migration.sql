-- Supabase Data API grants audit - 2026-05-14
--
-- Audit result:
-- - Browser Supabase usage is limited to Auth/MFA/session helpers.
-- - No supabase.from(...), /rest/v1, or GraphQL table access is used by the app.
-- - Sensitive business tables stay server-only through Prisma/database access.
--
-- Security posture:
-- - Enable RLS on public application tables.
-- - Revoke anon/authenticated table privileges by default.
-- - Re-grant read-only Data API access only to intentionally public content:
--   published CMS/blog pages and active public credit packages.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'User',
    'AiTool',
    'BusinessExpense',
    'AiJob',
    'Ticket',
    'TicketMessage',
    'MediaAsset',
    'CreditTransaction',
    'CreditPackage',
    'Payment',
    'Subscription',
    'ProviderSetting',
    'ProviderLog',
    'JobEvent',
    'AdminLog',
    'BlogPost',
    'Page',
    'SiteSetting',
    'FeatureFlag',
    'Experiment',
    'TrackingSetting',
    'WebhookLog',
    'EmailEvent',
    'Referral',
    'NewsletterSubscriber',
    'AuditEvent',
    'RateLimit'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END $$;

-- Public CMS/legal pages can be read through the Data API if needed.
-- Draft, archived, and soft-deleted pages remain hidden.
GRANT SELECT ON TABLE public."Page" TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read published pages" ON public."Page";
CREATE POLICY "Public can read published pages"
ON public."Page"
FOR SELECT
TO anon, authenticated
USING (
  status = 'PUBLISHED'
  AND "deletedAt" IS NULL
);

-- Public blog content can be read through the Data API if the blog is enabled later.
-- Draft, archived, and soft-deleted posts remain hidden.
GRANT SELECT ON TABLE public."BlogPost" TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read published blog posts" ON public."BlogPost";
CREATE POLICY "Public can read published blog posts"
ON public."BlogPost"
FOR SELECT
TO anon, authenticated
USING (
  status = 'PUBLISHED'
  AND "deletedAt" IS NULL
);

-- Public pricing cards can be read through the Data API if needed.
-- Inactive, suspended, and soft-deleted packages remain hidden.
GRANT SELECT ON TABLE public."CreditPackage" TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read active credit packages" ON public."CreditPackage";
CREATE POLICY "Public can read active credit packages"
ON public."CreditPackage"
FOR SELECT
TO anon, authenticated
USING (
  status = 'ACTIVE'
  AND "deletedAt" IS NULL
);

-- No Data API grants are intentionally added for:
-- User, AiJob, MediaAsset, CreditTransaction, Payment, Ticket,
-- TicketMessage, ProviderSetting, ProviderLog, WebhookLog, AdminLog,
-- BusinessExpense, SiteSetting, TrackingSetting, AuditEvent, RateLimit,
-- EmailEvent, Referral, Subscription, FeatureFlag, Experiment, or AiTool.
--
-- Those tables are private/server-only. If future client-side Supabase table
-- access is introduced, add narrow GRANT statements and owner/admin RLS
-- policies in a separate migration.

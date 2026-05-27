-- Supabase public schema RLS hardening - 2026-05-27
--
-- The application uses Prisma/server-side database access for business data.
-- Browser Supabase usage is limited to Auth/MFA/session helpers, so public
-- Data API access stays revoked by default. Only intentionally public read
-- surfaces are re-granted below.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    '_prisma_migrations',
    'User',
    'AffiliateProfile',
    'ReferralClick',
    'ReferralSignup',
    'ReferralReward',
    'AffiliatePayoutSnapshot',
    'AiTool',
    'BusinessExpense',
    'AiJob',
    'Ticket',
    'TicketMessage',
    'MediaAsset',
    'CreditTransaction',
    'FreeTrialClaim',
    'VerificationJob',
    'VerificationEmailResult',
    'VerificationBatch',
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
    'BackupEvent',
    'AnalyticsEvent',
    'Referral',
    'NewsletterSubscriber',
    'AuditEvent',
    'RateLimit'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    END IF;
  END LOOP;
END $$;

-- Public CMS/legal pages can be read through the Data API if needed.
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

-- Public blog content can be read through the Data API if the blog is enabled.
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

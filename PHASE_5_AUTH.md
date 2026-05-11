# Phase 5 Auth Setup

Phase 5 replaces the temporary dev/test user flow with Supabase Auth sessions.

## Required environment variables

Add these values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY"
```

Keep the existing database, R2, Replicate, and PhotoRoom variables unchanged.

## Supabase dashboard settings

1. Open Supabase dashboard.
2. Go to Authentication > URL Configuration.
3. Set Site URL:

```text
http://localhost:3000
```

4. Add Redirect URLs:

```text
http://localhost:3000/auth/callback
http://localhost:3000/dashboard
```

5. Go to Authentication > Providers.
6. Keep Email enabled for Magic Link login.
7. Enable Google only after creating Google OAuth credentials.

## Email template check

For the smooth first-time Magic Link flow, Supabase email templates must use the real confirmation URL or redirect target instead of sending users back to a plain Site URL.

In Authentication > Email Templates, the default hosted template should include a link based on:

```txt
{{ .ConfirmationURL }}
```

If you customized templates, make sure the confirmation and magic-link buttons do not point directly to `{{ .SiteURL }}` only. They must preserve the Supabase verification URL and redirect back to:

```txt
http://localhost:3000/auth/callback
```

The app callback page can now finish both `code` and browser-session callback flows, then send the user to `/dashboard`.

## Google OAuth setup

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure OAuth consent screen.
4. Create an OAuth Client ID for a Web application.
5. Add Authorized redirect URI from Supabase Google provider settings. It usually looks like:

```text
https://PROJECT_REF.supabase.co/auth/v1/callback
```

6. Copy the Google Client ID and Client Secret into Supabase Authentication > Providers > Google.
7. Save the provider settings.

## Local auth test flow

1. Start the app:

```bash
npm run dev
```

2. Open:

```text
http://localhost:3000/auth/sign-in
```

3. Test Magic Link:
   - Enter an email address.
   - Click Send Magic Link.
   - Open the email link.
   - Confirm the app redirects back to `/dashboard`.

4. Test Google:
   - Click Continue with Google.
   - Finish the Google OAuth flow.
   - Confirm the app redirects back to `/dashboard`.

5. Test protected dashboard:
   - Sign out from the dashboard sidebar.
   - Open `/dashboard`.
   - Confirm it redirects to `/auth/sign-in?next=/dashboard`.

6. Test homepage upload:
   - Sign in.
   - Open the homepage.
   - Upload an image.
   - Run Background Remover or Photo Enhancer.
   - Confirm the job appears in dashboard history under the signed-in user.

## API behavior

Upload, job creation, ratings, downloads, and dev provider comparison now use the authenticated Supabase session. The old `x-zeylora-user-id` header and dev fallback user are no longer used by active API code.

## Future notes

- Credits and subscriptions can attach to the same Prisma `User` record.
- Mobile clients can reuse Supabase Auth and call the same API surface once bearer-token support is added.
- Admin roles should remain stored in the application database, not inferred from public auth metadata.

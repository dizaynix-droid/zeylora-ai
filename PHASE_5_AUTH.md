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
6. Keep Email enabled for email/password login, email verification, and password recovery.
7. Enable Google only after creating Google OAuth credentials.

Production redirect allow-list should include the live domains and callback URLs:

```text
https://www.zeylora.ai/**
https://zeylora.ai/**
https://zeylora-ai.vercel.app/**
https://www.zeylora.ai/auth/callback
https://zeylora.ai/auth/callback
https://zeylora-ai.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

## Email verification and password reset

For the smooth first-time email verification and password reset flow, Supabase email templates must use the real confirmation/recovery URL or redirect target instead of sending users back to a plain Site URL.

In Authentication > Email Templates, the default hosted template should include a link based on:

```txt
{{ .ConfirmationURL }}
```

If you customized templates, make sure confirmation and recovery buttons do not point directly to `{{ .SiteURL }}` only. They must preserve the Supabase verification URL and redirect back to:

```txt
http://localhost:3000/auth/callback
```

Email/password sign-up sends `emailRedirectTo=/auth/callback`. Password reset sends users through `/auth/callback?next=/auth/update-password`, then `/auth/update-password` lets the recovery session set a new password.

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

The app sends Google OAuth users to:

```text
/auth/callback?next=<safe-relative-path>
```

The callback exchanges the PKCE code, writes Supabase cookies, syncs the application `User` profile, and redirects to the safe `next` path or `/dashboard`.

## Local auth test flow

1. Start the app:

```bash
npm run dev
```

2. Open:

```text
http://localhost:3000/auth/sign-in
```

3. Test email/password:
   - Create an account with email and password.
   - If confirmation is enabled, open the verification email.
   - Confirm the app redirects back to `/dashboard`.

4. Test Google:
   - Click Continue with Google.
   - Finish the Google OAuth flow.
   - Confirm the app redirects back to `/dashboard`.

5. Test password reset:
   - Enter email on `/auth/sign-in`.
   - Click Forgot password.
   - Open the recovery email.
   - Set a new password on `/auth/update-password`.
   - Confirm the dashboard opens.

6. Test protected dashboard:
   - Sign out from the dashboard sidebar.
   - Open `/dashboard`.
   - Confirm it redirects to `/auth/sign-in?next=/dashboard`.

7. Test homepage upload:
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
- Admin accounts should use unique strong passwords now; mandatory admin 2FA is prepared as a future hardening step.

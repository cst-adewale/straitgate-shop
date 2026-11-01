# Straitgate site

`public/` contains the public pages and assets. `server.js` serves these pages, maps `/` to `straitgate-home.html`, and checks the admin session before serving `private/straitgate-admin.html` at `/admin`.

`drafts/` contains older page designs and the authentication UI demo. Render does not publish this folder.

Keep `.env` in the project root. It is ignored by Git and outside Render's static publish folder.

The admin dashboard stores its sample data in each browser's local storage; it is not a shared database. The server defaults to the production Neon Auth URL; set `NEON_AUTH_BASE_URL` only to use a different branch. Start with `node server.js` and open `http://localhost:3000/`. The Admin footer link opens the protected `/admin` route.

`render.yaml` defines a Node web service with the production Neon Auth URL. Render does not need `ADMIN_EMAIL`, `ADMIN_PASSWORD`, or `SESSION_SECRET`. If the site was already deployed as a Render Static Site, create a new Blueprint/web service from this configuration and switch the domain to it. A Static Site cannot enforce server-side admin access.

## Neon status

The existing `straitgate` Neon project has Managed Auth and the Data API enabled on its production branch. `migrations/001_straitgate_core.sql` has been applied to production and to a separate `dev` branch. It creates `products`, `inventory_items`, and `quotes` with row-level security. The first production Auth admin account is `gospel.adewale7@gmail.com`.

`neon.ts` declares the desired Auth and Data API configuration. Do not place Neon credentials in `public/` or commit them to source control. The Data API URL is branch-specific; use the production URL when configuring production.

`server.js` now sends sign-in and session checks to Neon Auth and allows access to `/admin` only when the Neon user has role `admin`. The catalog and dashboard still use hard-coded or browser-local data, not the new tables. The first Neon admin account needs an email/password setup flow before its owner can sign in. Verify that flow on the deployed app before considering the login migration complete.

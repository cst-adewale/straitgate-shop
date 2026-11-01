# Straitgate site

`public/` contains the public pages and assets. `server.js` serves these pages, maps `/` to `straitgate-home.html`, and checks the admin session before serving `private/straitgate-admin.html` at `/admin`.

`drafts/` contains older page designs and the authentication UI demo. Render does not publish this folder.

Keep `.env` in the project root. It is ignored by Git and outside Render's static publish folder.

The admin dashboard stores its sample data in each browser's local storage; it is not a shared database. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a random `SESSION_SECRET` of at least 32 characters before starting the server with `node server.js`. Open `http://localhost:3000/` to use the site. The Admin footer link opens the protected `/admin` route.

`render.yaml` now defines a Node web service. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render; it generates `SESSION_SECRET`. If the site was already deployed as a Render Static Site, create a new Blueprint/web service from this configuration and switch the domain to it. A Static Site cannot enforce server-side admin access.

## Neon status

The existing `straitgate` Neon project has Managed Auth and the Data API enabled on its production branch. `migrations/001_straitgate_core.sql` has been applied to production and to a separate `dev` branch. It creates `products`, `inventory_items`, and `quotes` with row-level security. The first production Auth admin account is `gospel.adewale7@gmail.com`.

`neon.ts` declares the desired Auth and Data API configuration. Do not place Neon credentials in `public/` or commit them to source control. The Data API URL is branch-specific; use the production URL when configuring production.

**Integration remains:** `server.js` still authenticates against `ADMIN_EMAIL` and `ADMIN_PASSWORD`, not Neon Auth. The catalog and dashboard still use hard-coded or browser-local data, not the new tables. The Neon account needs a password setup/sign-in flow before it can replace the current admin login. Do not remove the existing Render credentials until those flows are implemented and tested.

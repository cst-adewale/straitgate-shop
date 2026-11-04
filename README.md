# Straitgate site

`public/` contains the public pages and assets. `server.js` serves these pages, maps `/` to `straitgate-home.html`, and checks the admin session before serving `private/straitgate-admin.html` at `/admin`.

`drafts/` contains older page designs and the authentication UI demo. Render does not publish this folder.

Keep `.env` in the project root. It is ignored by Git and outside Render's static publish folder.

The admin dashboard reads and writes products, inventory, and quotations through the protected `/api/admin/data` endpoint. Its overview uses those database records; the converter and calculator are local utilities. Set `DATABASE_URL` to the production Neon's pooled Postgres connection string in Render's Environment settings. Keep it secret. Until set, the dashboard shows a database configuration error rather than sample data. The server defaults to the production Neon Auth URL; set `NEON_AUTH_BASE_URL` only to use a different branch. Start with `node server.js` and open `http://localhost:3000/`. The Admin footer link opens the protected `/admin` route.

Product JPEGs upload to a private Cloudflare R2 bucket. Create a bucket and bucket-scoped Object Read & Write R2 API token in Cloudflare, then set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in Render's Environment settings. For an EU, US, or FedRAMP jurisdiction bucket, also set `R2_ENDPOINT` to its jurisdiction-specific S3 endpoint. Never put these secrets in `public/` or commit them. The app stores only an object key in Neon and serves images for published products through `/api/product-image/:id`; the bucket does not need public access. Image uploads require all R2 settings. A product without an image can still be saved.

`render.yaml` defines a Node web service with the production Neon Auth URL. Render does not need `ADMIN_EMAIL`, `ADMIN_PASSWORD`, or `SESSION_SECRET`. If the site was already deployed as a Render Static Site, create a new Blueprint/web service from this configuration and switch the domain to it. A Static Site cannot enforce server-side admin access.

## Neon status

The existing `straitgate` Neon project has Managed Auth and the Data API enabled on its production branch. `migrations/001_straitgate_core.sql` has been applied to production and to a separate `dev` branch. It creates `products`, `inventory_items`, and `quotes` with row-level security. `migrations/002_admin_data.sql` adds product image data and quotation validity dates; it has been applied to production and dev. `migrations/003_r2_images.sql` adds the R2 object key. The first production Auth admin account is `gospel.adewale7@gmail.com`.

`neon.ts` declares the desired Auth and Data API configuration. Do not place Neon credentials in `public/` or commit them to source control. The Data API URL is branch-specific; use the production URL when configuring production.

`server.js` sends sign-in and session checks to Neon Auth and allows access to `/admin` only when the Neon user has role `admin`. The admin login modal's Forgot password action requests a Neon reset email; the email links to `/straitgate-reset-password.html` for choosing a new password. Set `PUBLIC_ORIGIN` to the actual deployed site origin and add that origin to the production branch's Neon Auth trusted domains. The public catalog and product details now read published products from `/api/products`; an admin-added product is published immediately. The shop will be empty until real products are added. No tax is added to quotations until a business tax policy is configured. Verify the full flow on the deployed app. Neon currently uses shared SMTP; configure custom SMTP for production email delivery.

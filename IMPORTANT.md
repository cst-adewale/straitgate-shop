# Important Production Readiness Tasks

This file tracks production-grade backend work that still requires implementation, configuration, or operational verification.

## External infrastructure and configuration

- [ ] Configure Cloudflare WAF rules for common attacks, abusive paths, and suspicious request patterns.
- [ ] Confirm DDoS protection, DNS, TLS, and production-only HTTPS enforcement.
- [ ] Configure Render autoscaling targets and confirm the service runs at least two instances in production.
- [ ] Add distributed rate limiting using Redis or another shared store. Current rate limits are in-memory per Node instance.
- [ ] Configure private networking and least-privilege access for the production database.
- [ ] Keep production, staging, and development Neon branches and credentials separate.
- [ ] Configure secrets through Render/CI secret storage and rotate database, R2, Auth, and payment credentials regularly.
- [ ] Configure encrypted backups, retention rules, point-in-time recovery where available, and a separate backup destination.
- [ ] Perform and document a real backup restore drill.
- [ ] Configure centralized logs, retention, alerts, and sensitive-data redaction.
- [ ] Configure Sentry or OpenTelemetry with metrics, traces, error alerts, and latency alerts.
- [ ] Add GitHub secret scanning, dependency scanning, and vulnerability alerts.
- [ ] Add staged deployments, health-check verification, rollback procedures, and an incident runbook.

## Authentication and security

- [ ] Enable MFA or passkeys for administrators and any future seller accounts.
- [ ] Verify email confirmation and account recovery policies in Neon Auth.
- [ ] Review session expiration, session rotation, logout invalidation, and revoked-session behavior.
- [ ] Add a strict Content Security Policy after removing or nonce-protecting inline scripts.
- [ ] Review CSRF protection for every state-changing cookie-authenticated endpoint.
- [ ] Add security regression tests for authorization, object ownership, cookies, CORS/origin checks, and rate limits.
- [ ] Add audit logging for administrator sign-ins, product changes, inventory changes, quotations, refunds, and payment events.
- [ ] Add upload malware/content inspection if arbitrary customer uploads are introduced.
- [ ] Review outbound network access and add SSRF protections if URL-based imports or webhooks are added.
- [ ] Run an independent penetration test before handling significant customer or payment volume.

## Commerce and payment security

- [ ] Implement server-side checkout totals using database prices, discounts, stock, shipping, and tax rules.
- [ ] Add orders and order-status transitions backed by PostgreSQL transactions.
- [ ] Add inventory reservations with expiration and row-level locking to prevent overselling.
- [ ] Integrate Flutterwave using server-created payment references and never trust frontend success messages.
- [ ] Verify Flutterwave transactions server-side for amount, currency, reference, and customer/order identity.
- [ ] Add signed webhook verification and replay protection.
- [ ] Add idempotency keys for checkout, payment confirmation, webhook handling, and refunds.
- [ ] Add payment reconciliation for delayed, failed, reversed, and disputed transactions.
- [ ] Add refund authorization, audit trails, and financial ledger entries.
- [ ] Keep card data out of the application and review PCI DSS responsibilities with the payment provider.
- [ ] Add fraud controls for repeated payments, unusual order values, account takeover, and refund abuse.

## Database and performance

- [ ] Add foreign keys, unique constraints, check constraints, and indexes for all new commerce tables.
- [ ] Add transaction and concurrency tests for inventory, orders, payments, and refunds.
- [ ] Add query timing and slow-query monitoring.
- [ ] Add cache invalidation rules if Redis/CDN caching is introduced.
- [ ] Add background workers and retry policies for email, notifications, image processing, reconciliation, and indexing.
- [ ] Add circuit breakers for Neon Auth, Flutterwave, R2, and other external services.
- [ ] Add load, stress, and soak tests against staging.
- [ ] Define data retention, export, correction, and deletion procedures.

## Current implementation notes

- Node.js backend: `server.js`
- PostgreSQL/Neon data layer: `admin-data.js`, `customer-data.js`
- Authentication: Neon Auth
- Object storage: Cloudflare R2
- Hosting/load balancing: Render web service
- Flutterwave SDK installed: `flutterwave-node-v3`
- Existing protections include parameterized SQL, origin checks, secure response headers, HTTP timeouts, health checks, login rate limits, encrypted backup tooling, and Render multi-instance configuration.


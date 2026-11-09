# Warehouse Manager

Business app for a Bosnian B2B company: stock with a full movement ledger, orders with reservations, customers, a POS till, invoices with payments and storno, and a dashboard. The UI is in Bosnian.

Next.js (App Router, Cache Components) on Supabase (PostgreSQL, Auth, Row Level Security). Business rules live in the database: stock, reservations, prices, VAT, document numbers and access control are enforced by PostgreSQL functions and RLS, not by the browser.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS
- Supabase: PostgreSQL, Auth, RLS, RPC functions (`supabase/migrations`)
- TanStack Query, React Hook Form + Zod, Recharts, Lucide
- Vitest (unit and database tests), Playwright (end-to-end)

## Local development

Prerequisites: Node.js 20+, Docker (on macOS: [OrbStack](https://orbstack.dev) or Docker Desktop).

```bash
npm ci
npm run db:start          # local Supabase in Docker
npx supabase status -o env  # copy API_URL, PUBLISHABLE_KEY and SERVICE_ROLE_KEY into .env.local
npm run db:reset          # applies migrations and seed.sql; WARNING: replaces local database data
npm run dev               # http://localhost:3000
```

Environment variables (`.env.local`, and the same names in Vercel):

| Variable | Where it is used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser and server; safe to expose, RLS decides what each user sees |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (`src/lib/supabase/admin.ts`): creating users, banning deactivated users, the sign-in attempt counter. Never prefix it with `NEXT_PUBLIC_` |

### Test accounts (local database only)

| E-mail | Password | Role |
|---|---|---|
| `admin@demo.ba` | `Demo1234` | admin |
| `menadzer@demo.ba` | `Demo1234` | menadzer (manager) |
| `prodavac@demo.ba` | `Demo1234` | prodavac (sales) |

The seed is not applied to the cloud project. There, the first admin is created in the Supabase dashboard (Authentication → Users → Add user, with "Auto Confirm User"), then activated in the SQL Editor:

```sql
update public.profiles set role = 'admin', is_active = true where email = '…';
```

`is_active = true` is required: an account created outside the app has no admin-assigned role, so it starts deactivated (see `handle_new_user` in `supabase/migrations/20261018090000_rbac.sql`). Everyone else is created from the app (Postavke → Korisnici), which assigns the role and activates the account.

## Roles and permissions

One installation serves one company; every active user belongs to it. Roles are stored in `public.profiles.role` and assigned only by an admin. Nobody can change their own role, and a role written by a user into their own metadata is ignored.

The rules are defined once in `src/lib/permissions.ts` (38 permissions) and enforced on four levels:

1. **Database**: RLS policies and RPC functions (`supabase/migrations/*_rbac.sql`) check the role and record ownership on every read and write. This is the line that cannot be bypassed.
2. **Server Actions**: each one calls `authorize(permission)` (`src/server/auth.ts`) with the role read from the database, never from the request.
3. **Pages**: every page in `src/app/(app)` renders inside `<RequireAccess route=…>` (`src/server/guards.tsx`); a URL typed directly shows "Nemate pristup". A unit test fails if a page is added without it.
4. **UI**: the sidebar, buttons and fields follow the same permissions (convenience only).

| Area | admin | menadzer | prodavac |
|---|---|---|---|
| Dashboard | company | company | own sales only |
| Products: read, sale prices, availability | ✓ | ✓ | ✓ |
| Products: create, edit; purchase prices | ✓ | ✓ | – |
| Goods receipt, stock correction, stock count, stock history | ✓ | ✓ | – |
| Customers: read, add | ✓ | ✓ | ✓ |
| Customers: edit / delete | ✓ / ✓ | ✓ / – | – |
| Orders: create, process (confirm, deliver, cancel) | all | all | own and assigned |
| Orders: assign to a seller | ✓ | ✓ | – |
| POS sale | ✓ | ✓ | ✓ |
| Invoices: read, issue | all | all | for own orders and sales |
| Record payments | ✓ | ✓ | – |
| Storno (cancel an issued invoice) | ✓ | – | – |
| Suppliers and categories, ads (Oglasi), reports, employees (read) | ✓ | ✓ | – |
| Users and roles, settings, audit log | ✓ | – | – |
| Own password (Promijeni lozinku) | ✓ | ✓ | ✓ |

"Own" means orders the seller created or was assigned (`orders.assigned_to`), POS sales they rang up, and the invoices of those.

Security-relevant changes (roles, user status, settings, prices, stock corrections, storno, payments, order assignment) are written to `audit_logs` by triggers. Only admins can read it (Postavke → Audit log), and nobody can edit or delete it.

## Authentication

- Supabase Auth handles passwords (hashed by Supabase) and sessions (cookies set by `@supabase/ssr`, refreshed in `src/proxy.ts`). No password is stored in an app table, and passwords never appear in SQL, so any characters are allowed.
- Password rule: at least 8 characters with letters and digits (`supabase/config.toml` and the Zod schema in `src/lib/schemas/auth.ts`).
- Public sign-up is disabled. An account created without an admin-assigned role gets no access.
- Sign-in shows the same message for an unknown e-mail and a wrong password. After 5 failed attempts per e-mail (or 20 per IP) in 15 minutes, sign-in is blocked for that e-mail; password-reset requests are limited too (`src/server/actions/auth.ts`, `auth_attempt_allowed` in the database).
- Password reset: e-mail link → `/auth/confirm` → `/update-password`. Locally the e-mails arrive in Mailpit (http://127.0.0.1:54324).

## Business flows

- **Orders**: nacrt → potvrđena (reserves stock) → isporučena (stock leaves) → fakturisana, or otkazana. Each step is one RPC transaction with an idempotency key, so a double click books once.
- **POS**: sells only available stock (never what confirmed orders reserved), receipt numbers `P-0001/2026`, discount limited by role (settings).
- **Invoices**: from a delivered order or a POS sale with a customer, numbers `0001/2026` without gaps. Issued invoices cannot be changed; a storno document with negative amounts cancels one.
- **Stock**: every change is a row in the append-only `inventory_movements` ledger.
- **Warehouse list**: filter by category, status, and location; sort by name, SKU, stock, availability, or price. Search includes OEM/catalog numbers.
- **Customers**: matching e-mail addresses or phone numbers trigger a duplicate warning before saving; the user can review and explicitly continue.
- **Demo documents**: printed POS receipts and invoices are marked as non-fiscal demo documents.
- **Sales overview**: the monthly chart opens a role-scoped list of its POS sales, order invoices, and storno documents; the current month's storno count links to the filtered invoice list.
- Prices are net (bez PDV-a); VAT comes from the product, rounding happens in the database.

## Tests

```bash
npm run typecheck
npm run lint
npm test                 # unit tests: permissions matrix, page guards, money, schemas
npm run db:reset         # fresh local data; wait a few seconds for the API to reload
npm run test:db          # database tests: RLS per role, RPC rules, idempotency, invoices
npm run test:e2e         # browser tests (Playwright, uses the installed Google Chrome)
```

`test:db` and `test:e2e` need the local Supabase stack (`npm run db:start`) and a fresh `npm run db:reset`. `test:e2e` builds the app and serves it on port 3100.

## Project structure

```
src/app/(auth)        login, forgot and update password
src/app/(app)         signed-in pages, each wrapped in <RequireAccess>
src/components        app shell, dashboard, shared UI (src/components/ui)
src/lib/permissions.ts  roles, permissions, route access
src/lib/queries       data reads (browser client, RLS applies)
src/lib/schemas       Zod schemas shared by forms and Server Actions
src/server            Server Actions, auth helpers, page guards
supabase/migrations   schema, RLS, RPC functions (never edit an applied migration; add a new one)
tests/db              database tests (Vitest)
e2e                   browser tests (Playwright)
```

## Deployment

Vercel deploys `main`. When a change includes new migrations:

1. `npx supabase db push` (applies new migrations to the linked cloud project), **then**
2. merge to `main`.

In the other order the new app would expect tables and functions the cloud database does not have yet.

Auth and API settings are not part of the migrations. In the Supabase dashboard keep:

- **Authentication → Sign In / Providers**: sign-up disabled, anonymous sign-ins disabled; under Email: **Confirm email on** and **Secure email change on**. With confirmation off, Auth applies an e-mail change at once, so anyone at an open session could move an account to their own address and take it over through "forgot password". Accounts created from the app are confirmed already.
- **Authentication → Policies / Passwords**: minimum length 8 with letters and digits, secure password change on.
- **Authentication → URL Configuration**: the production URL as Site URL and `https://<production-url>/**` under Redirect URLs.
- **Authentication → Emails**: the "Reset password" template from `supabase/templates/recovery.html`.
- **Integrations → Data API → Exposed schemas**: only `public` (remove `graphql_public`; the app uses no GraphQL).

Never run `npx supabase config push`: it would overwrite these cloud settings with the local ones from `supabase/config.toml` (localhost URLs).

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request: typecheck, lint, unit tests and build, then the database and browser tests against a local Supabase stack started in the runner. The jobs get a read-only token and no secrets.

## Security

What protects the data, from the inside out:

- **Database**: RLS on every table, role and ownership checks in every RPC, purchase prices hidden by column privileges, append-only ledger and audit log. Security-definer views are not used: every view is `security_invoker`, so RLS applies to it.
- **Server**: every Server Action calls `authorize()` and validates its input with Zod; the service role key is used only in `src/lib/supabase/admin.ts` (`server-only`). Redirect targets after login are checked by `safeRedirectPath` (`src/lib/safe-redirect.ts`). A new password without the current one is accepted only from a session opened by the reset link within the last hour (`updatePassword`); signed-in users change it with their current password (`changePassword`), and other devices are signed out.
- **Direct API writes**: rules that Zod checks are also constraints and column privileges in the database (`*_security_hardening.sql`): only http(s) links, no `NaN` prices, no client-chosen ids. Every new table needs `enable row level security` and explicit policies: Supabase grants new tables to `authenticated` by default.
- **Exports**: CSV cells that Excel would evaluate as formulas (`= + - @`) are prefixed with `'` (`src/lib/csv.ts`).
- **Browser**: security headers and a Content-Security-Policy in `next.config.ts`: scripts, connections, images and fonts only from this site and Supabase; no framing (clickjacking); HSTS. The CSP has no nonces, because nonces require fully dynamic rendering and the app uses Partial Prerendering; inline scripts are therefore still allowed.
- **Tests**: `tests/db` and `e2e` refuse to run unless `NEXT_PUBLIC_SUPABASE_URL` points to the local stack, so they can't change the cloud data.

### Vercel environments

Vercel builds a Preview deployment for every pushed branch, with the variables of the Preview environment. Previews must not get the production `SUPABASE_SERVICE_ROLE_KEY`, or unreviewed code would run with full access to the company's data:

1. **Settings → Environment Variables**: `SUPABASE_SERVICE_ROLE_KEY` only for **Production**. (Previews then can't create users or ban accounts, which is fine; for full previews use a separate Supabase project with its own keys.)
2. **Settings → Deployment Protection**: keep **Vercel Authentication** on for previews, so only members of the Vercel team can open them.
3. Delete old preview deployments of branches that are merged.

### Dependencies

Keep `next` on the newest patch release: Next.js publishes security fixes as patch versions (e.g. 16.4.1 fixed a Server Actions denial of service and two remote code execution issues in 16.4.0). Check with `npm outdated` and `npm audit` before each release.

## Production

### E-mail (SMTP)

Supabase's built-in mailer is for testing only (a few messages per hour, team members only), so password-reset e-mails don't reach real users until a custom SMTP server is set. In the Supabase dashboard: **Authentication → Emails → SMTP Settings → Enable custom SMTP**.

| | Gmail (no own domain needed) | Resend (own domain) |
|---|---|---|
| Host | `smtp.gmail.com` | `smtp.resend.com` |
| Port | `465` | `465` |
| Username | the Gmail address | `resend` |
| Password | an App Password (Google account → Security → 2-Step Verification on → App passwords) | an API key from resend.com |
| Sender | the same Gmail address | an address on the verified domain |

Then send yourself a reset link from `/forgot-password` to check it. With Gmail, use a mailbox made only for sending (an App Password gives full access to the mailbox it belongs to).

### Backups

The cloud database is the only copy of the company's data. Make a backup regularly (for example weekly, and before every `npx supabase db push`). It needs Docker running (OrbStack) and the linked project:

```bash
mkdir -p backups
npx supabase db dump --linked --role-only -f backups/roles.sql
npx supabase db dump --linked -f backups/schema.sql
npx supabase db dump --linked --data-only --use-copy -f backups/data.sql
```

`backups/` is in `.gitignore`: the files contain customer data and password hashes and must never be committed. Keep an encrypted copy outside the laptop (for example an encrypted disk image on macOS: Disk Utility → File → New Image → Image from Folder, encryption AES-256), and check that `data.sql` is not empty.

Restoring goes into a new, empty Supabase project (connection string: dashboard → **Connect**), following Supabase's guide "Backup and restore using the CLI":

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file backups/roles.sql \
  --file backups/schema.sql \
  --command 'set session_replication_role = replica' \
  --file backups/data.sql \
  --dbname "<connection string of the new project>"
```

`session_replication_role = replica` switches triggers off during the load, so the append-only and immutability guards don't block it. If `psql` is missing on macOS: `brew install libpq && brew link --force libpq`.

## Known limitations

- Purchasing (Nabavka) and integrations are hidden from the menu until they do real work. The purchasing view that reads the procurement documents stays in `src/components/modules/procurement.tsx`; creating purchase orders, their line items and receiving them are not implemented.
- Ads (Oglasi) are tracked manually; OLX, Viber, e-mail and web-form channels are not connected, and status changes are not synchronized with them.
- The inquiry inbox/conversion-to-order workflow, expiring reservations, and CSV/XLSX import are not implemented.
- Product and customer lists can be exported as CSV; XLSX export and import are not implemented.
- Reports include dashboard and monthly sales totals; date, product, category, and employee filters are not implemented.
- No multi-company (organization) separation: one installation per company.
- No MFA or CAPTCHA yet (Supabase's TOTP MFA is available on the free plan and is the next step for admin accounts); leaked-password checks require a paid Supabase plan.
- POS receipts are not fiscal receipts: cash sales to consumers in B&H must also go through a certified fiscal device.

# Kiln & Linen

An independent homeware store (ceramics, lighting, textiles, tableware) with a full shopping flow and a **payment sandbox**. Customers browse, search, filter, add to a cart, check out and pay with simulated cards. Administrators manage products, categories and orders.

No real money can move: the only payment provider implemented is the sandbox, and the app refuses to start with any other `PAYMENT_PROVIDER`.

## Features

- **Catalog**: product pages, categories, name search, category and price filters, sorting, pagination, stock indicators, loading / empty / error states.
- **Cart**: stored in the database per signed-in user, quantity limits, live stock validation, totals recalculated on the server.
- **Checkout**: delivery details, payment method, server-side validation, idempotent order creation, stock reserved in one transaction.
- **Payment sandbox**: test cards, success and failure outcomes, payment records with transaction references, state machine, signed webhook endpoint, idempotent payment requests.
- **Orders**: customer history and details, immutable price snapshots, order and payment statuses, order confirmation page.
- **Admin**: overview, product CRUD (archive instead of delete), stock and price management, category management, order list and detail, guarded status changes.
- **Auth**: registration, login, logout, bcrypt password hashing, database-backed sessions, role-based authorization enforced on the server.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · PostgreSQL · Drizzle ORM · Zod · bcryptjs · plain CSS with design tokens · Vitest.

Why Drizzle instead of Prisma: it is a type-safe SQL-first ORM with generated SQL migrations and no binary engine download, which keeps installs reproducible in restricted environments. Everything else follows the preferred stack.

## Architecture overview

```
Browser ──► Next.js pages (server components read through services)
        └─► Client components ──► /api/* route handlers
                                      │  api() wrapper: session → role check → origin check → rate limit → handler
                                      ▼
                               src/server/* services (business rules, transactions)
                                      ▼
                               Drizzle ──► PostgreSQL
```

- `src/lib`: pure, framework-free code (pricing, state machines, validation schemas, formatting). Unit-tested.
- `src/server`: services (catalog, cart, orders, admin, auth, sessions, payments, rate limit) and the `api()` route wrapper.
- `src/app`: pages and `/api` route handlers; handlers only parse input and call a service.
- `src/components`: React components. Client components are limited to interactive parts (forms, steppers).
- `src/db`: schema and connection. `drizzle/`: generated SQL migrations.

More detail, the schema and the payment workflow: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Folder structure

```
src/app/            pages, layouts, api/ route handlers
src/components/     UI components (admin/ for admin-only forms)
src/lib/            pricing, states, validation, money, format (+ client/ helpers)
src/server/         services, http wrapper, session, rate limit, payments/
src/db/             Drizzle schema and client
src/styles/         tokens.css, base.css, components.css, pages.css
drizzle/            SQL migrations
scripts/            migrate, seed, reset, create-admin, run-e2e
tests/              unit/, integration/, e2e/
docs/               architecture, demo script, requirements checklist
public/products/    product illustrations (SVG)
```

## Prerequisites

Node.js 20+ (developed on 22), npm, PostgreSQL 14+.

## Setup

```bash
npm install
cp .env.example .env            # then edit values
createdb shop                   # or create any database and set DATABASE_URL
npm run db:migrate              # apply migrations
npm run db:seed                 # 4 categories, 12 products (safe to re-run)
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PAYMENT_PROVIDER` | Must be `sandbox` (default). Other values stop the app at startup |
| `PAYMENT_WEBHOOK_SECRET` | HMAC secret for webhook signatures, at least 16 characters (`openssl rand -hex 32`) |
| `APP_URL` | Public base URL; used for the same-origin check and the `Secure` cookie flag (`https://` enables it) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Read only by `npm run admin:create` |

### Create the first administrator

Nobody can become an admin through the app. Create one from the command line:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run admin:create
```

Running it again for the same email promotes that account and resets its password. No credentials are seeded or committed.

### Other database commands

- `npm run db:generate`: create a new migration after editing `src/db/schema.ts`.
- `npm run db:reset`: drop everything (refuses in production), then run `db:migrate` again.

## Scripts and tests

| Command | What it runs |
| --- | --- |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint`, `npm run typecheck` | ESLint, `tsc --noEmit` |
| `npm test` | Unit and integration tests |
| `npm run test:unit` / `test:integration` | One layer only |
| `npm run test:e2e:run` | Starts the built app on port 3100 and runs the end-to-end suite |

Integration tests use a real PostgreSQL database. They default to `postgresql://shop:shop@localhost:5432/shop_test` (override with `TEST_DATABASE_URL`), apply migrations automatically and truncate tables between tests, so never point it at data you care about. The e2e runner needs a migrated and seeded `DATABASE_URL`, and creates a throwaway admin user (`e2e-admin@example.test`) for its admin checks.

## Payment sandbox

1. Checkout creates an order (`PENDING_PAYMENT`) from the server-side cart and reserves stock.
2. The customer submits a test card. The server computes the amount from the stored order, never from the request.
3. A payment row is created (`PENDING`, with a `sbx_…` reference), then the sandbox provider decides the outcome from the card number.
4. The outcome is delivered as an HMAC-signed event to the same handler that serves `POST /api/payments/webhook`. The handler verifies the signature, checks the amount, and moves payment and order forward exactly once.

| Test card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |
| any other valid number | Fails ("sandbox accepts only test cards") |

Use any future expiry (`MM/YY`) and any 3 or 4 digit code. Card numbers and codes are validated, used in memory, and never stored; only the last four digits are kept.

Swapping in a real provider (for example Stripe test mode) means implementing the `PaymentProvider` interface in `src/server/payments/provider.ts` and pointing the provider's webhook at `/api/payments/webhook`. That integration is **not implemented**.

## API overview

All bodies are JSON. State-changing requests from browsers must be same-origin. Errors use `{ "error": { "code", "message", "details?" } }`.

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me` | public | Account and session |
| `GET /api/products`, `GET /api/products/:slug` | public | Catalog (`q`, `category`, `minPrice`, `maxPrice`, `sort`, `page`) |
| `GET /api/cart`; `POST /api/cart/items`; `PATCH`/`DELETE /api/cart/items/:productId` | customer | Cart |
| `POST /api/checkout` (`Idempotency-Key` header) | customer | Create order from cart |
| `GET /api/orders`, `GET /api/orders/:id` | customer, own orders only | Order history and detail |
| `POST /api/orders/:id/pay` (`Idempotency-Key` header) | customer, own orders only | Sandbox payment attempt |
| `POST /api/payments/webhook` (`X-Signature: sha256=<hmac>`) | signed | Payment events |
| `GET`/`POST /api/admin/products`, `GET`/`PATCH`/`DELETE /api/admin/products/:id` | admin | Products (DELETE archives) |
| `GET`/`POST /api/admin/categories`, `PATCH`/`DELETE /api/admin/categories/:id` | admin | Categories |
| `GET /api/admin/orders`, `GET`/`PATCH /api/admin/orders/:id` | admin | Orders and status changes |

## Security notes

- Passwords: bcrypt (cost 12). Login errors are identical for unknown emails and wrong passwords, with a dummy hash comparison to equalize timing.
- Sessions: random 256-bit tokens in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` when `APP_URL` is https). Only a SHA-256 hash is stored.
- Authorization is enforced in the `api()` wrapper (401 unauthenticated, 403 non-admin) and again in admin pages. Customers get 404, not 403, for other people's orders. Role is never read from the client.
- Cross-site request forgery: `SameSite=Lax`, a same-origin check on every non-GET API call, and JSON-only bodies.
- Inputs are validated with Zod on the server; SQL goes through Drizzle's parameterized queries; `LIKE` wildcards in search are escaped.
- Prices, totals and payment amounts always come from the database. Order lines snapshot name and price.
- Payments: sandbox-only (enforced at startup), HMAC-verified webhooks with constant-time comparison, amount matching, state-machine guards, row locks, idempotency keys. A second successful charge on one order is automatically refunded.
- Rate limits on login/register, checkout, payment and webhook endpoints.
- Responses never include stack traces; unexpected errors are logged server-side and return a generic message. Security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) are set.
- `npm audit --omit=dev` reports no vulnerabilities. Dev-only advisories remain in `drizzle-kit`'s bundled esbuild, which only runs when generating migrations on a developer machine.

## Deployment

The app needs a Node.js host and PostgreSQL, for example Vercel (or any Node host) with Neon or Supabase.

1. Create a PostgreSQL database and copy its connection string.
2. Set the environment variables above on the host (`APP_URL` must be the public https URL, `PAYMENT_WEBHOOK_SECRET` a fresh random value).
3. Build with `npm run build`, start with `npm start` (Vercel detects this automatically).
4. From a machine that can reach the database, run `npm run db:migrate`, then `npm run db:seed` if you want the sample catalog, then `npm run admin:create`.

No demo URL exists: deploying requires hosting and database credentials that were not available while building this project.

## Known limitations

- Rate limiting is in memory, per process. Use a shared store such as Redis when running several instances.
- Stock is reserved when an order is created. An unpaid order holds its stock until an administrator cancels it (there is no automatic expiry job).
- The cart requires an account; there is no guest cart.
- No email notifications, password reset, tax handling or multi-currency (USD only).
- No real payment provider is integrated.
- Automated tests do not drive a real browser (browser downloads were unavailable where this was built). The end-to-end suite exercises the running production server over HTTP, including rendered pages, but client-side behavior (hydration, steppers, focus order) and responsive layout were not checked in a browser.
- No demo video was recorded; a script and checklist are in [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md).

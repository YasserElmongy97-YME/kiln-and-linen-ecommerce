# Requirements checklist

Statuses: PASS (evidence exists and was run), FAIL, NOT VERIFIED (built but not checked, or not possible here).

Evidence from the final run on a clean copy (`npm ci`, build, fresh database): typecheck clean, ESLint clean, **103 unit and integration tests passed** (26 unit, 77 integration, real PostgreSQL), **19 end-to-end tests passed** against the production server, `npm audit --omit=dev` found 0 vulnerabilities.

## Success criteria

| # | Requirement | Where | Verified by | Result | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Checkout safe, no real charge by default | `src/server/payments/provider.ts`, `src/lib/env.ts` | `payment-safety.test.ts`: default provider is sandbox and fails real-looking cards; `stripe`/`live`/`production` stop the app; secrets not echoed | 4/4 pass | PASS |
| 2 | Correct cart calculations and order totals | `src/lib/pricing.ts`, `src/server/cart.ts`, `orders.ts` | `pricing.test.ts`, `cart.test.ts`, `checkout-payment.test.ts` (totals, free-shipping threshold, client-sent prices ignored, price snapshots) | pass | PASS |
| 2 | Inventory validation, no overselling | `cart.ts`, `orders.ts` (row locks) | `cart.test.ts` stock cases; "second buyer is rejected" test | pass | PASS |
| 2 | Safe repeated requests | idempotency keys on checkout and pay | repeated and concurrent checkout create one order; repeated pay key returns one payment; racing payments leave one SUCCEEDED | pass | PASS |
| 3 | Customers cannot reach admin pages | `src/app/admin/*`, `requireAdmin` | e2e: signed-out redirect, customer gets 404 | pass | PASS |
| 3 | Customers cannot call admin APIs | `api({ access: "admin" })` | `admin.test.ts`: 12 endpoints x (anonymous 401, customer 403); writes leave data unchanged | pass | PASS |
| 3 | Customers cannot see others' orders | `getOrderDetail` scoped by user | integration and e2e: other user gets 404 on page and API; cannot pay another's order | pass | PASS |
| 3 | Admins can manage | admin routes and pages | `admin.test.ts`, e2e admin journey | pass | PASS |
| 4 | Primary flows work end to end | all modules | e2e: browse, filter, cart, checkout, failed and successful payment, confirmation, history, admin | 19/19 | PASS |
| 4 | Same flows work through the browser UI (forms, steppers, hydration) | `src/components/*` | Not exercised: no browser was available. The API behind every control is tested | n/a | NOT VERIFIED |
| 5 | Installs, builds, starts with documented commands | README | Clean copy: `npm ci`, `lint`, `typecheck`, `build`, `db:migrate`, `db:seed`, `admin:create`, tests, e2e | all succeed | PASS |

## Modules

| Requirement | Location | Verification | Status |
| --- | --- | --- | --- |
| Catalog: images, prices, details, categories | `src/app/products`, `src/server/catalog.ts` | `catalog.test.ts`, e2e | PASS |
| Search, category and price filters, sorting | same | `catalog.test.ts` (incl. LIKE escaping), e2e | PASS |
| Pagination, stock indicators | same, `product-tile.tsx` | integration (pagination), e2e (9 per page, "Page 1 of 2") | PASS |
| Loading, empty, error states | `products/(catalog)/loading.tsx`, `products/error.tsx`, empty states | Empty state asserted in e2e; loading and error boundaries not triggered in a browser | NOT VERIFIED |
| Cart: add, remove, quantity, limits, persistence | `src/server/cart.ts` | `cart.test.ts` | PASS |
| Unavailable items flagged | `getCart` issues | `cart.test.ts` | PASS |
| Checkout: customer, shipping, summary, payment method, validation | `src/app/checkout`, `checkout-form.tsx` | `checkout-payment.test.ts`, e2e (field errors) | PASS |
| Payment sandbox: outcomes, references, states, idempotency, webhook | `src/server/payments/*` | `checkout-payment.test.ts` (sandbox and webhook suites), `states.test.ts` | PASS |
| Provider abstraction | `PaymentProvider` interface | Code review only; no second provider exists | PASS (interface only) |
| Real provider integration (Stripe test mode) | n/a | Not implemented, documented as such | NOT VERIFIED |
| Orders: history, detail, items, totals, statuses | `src/app/orders` | e2e, integration | PASS |
| Order data immutable to later product changes | `order_items` snapshots | test "keeps order prices when the catalog price changes" | PASS |
| Admin: dashboard, product CRUD/archive, stock, price, categories, orders, status | `src/app/admin`, `src/server/admin.ts` | `admin.test.ts`, e2e | PASS |
| Auth: register, login, logout, hashing, sessions, roles | `src/server/auth.ts`, `session.ts` | `auth.test.ts` (hash format, uniform errors, no self-promotion, logout, rate limit, origin check) | PASS |
| Documented admin bootstrap | `scripts/create-admin.mts`, README | Used in clean-copy run and e2e | PASS |

## Security rules

| Rule | Status | Evidence |
| --- | --- | --- |
| Server-side validation (Zod) | PASS | validation unit tests, API 400 tests |
| Server-side authorization | PASS | permission tests above |
| Secrets in environment variables, none in frontend | PASS | `.env` ignored, `.env.example` committed; no secret used in client components (code review) |
| Prices from the database | PASS | client-sent totals and amounts ignored (tests) |
| Webhook protection | PASS | forged, missing and wrong-body signatures rejected; amount mismatch rejected; replay no-op |
| Rate limiting | PASS | login limit test; limits also configured for register, checkout, pay and webhook (only login asserted) |
| No sensitive data in errors | PASS | admin 403 body checked; env error omits values; 500s are generic |
| Card data not stored | PASS | test inspects the stored payment row |
| CSRF defenses | PASS | cross-origin request rejected (test); `SameSite=Lax` cookie |
| Dependency audit | PASS | 0 production vulnerabilities; dev-only esbuild advisory in drizzle-kit documented |

## Pages (16 required)

Home `/`, listing `/products`, detail `/products/[slug]`, cart `/cart`, checkout `/checkout`, confirmation `/orders/[id]/confirmation`, login, register, account, order history `/orders`, order detail `/orders/[id]`, admin dashboard `/admin`, admin products, admin product create/edit (`/new`, `/[id]`), admin orders (+ detail), 404 and error pages. All render in the production e2e run (HTTP 200 or the intended redirect/404). Status: PASS for rendering; layout and visual quality NOT VERIFIED.

## Design, accessibility, responsiveness

| Requirement | Status | Note |
| --- | --- | --- |
| Distinct editorial identity, no gradient/glass/card-grid clichés | NOT VERIFIED | Implemented from the design tokens; never viewed in a browser |
| Responsive (desktop, tablet, mobile) | NOT VERIFIED | Breakpoints at 960px and 700px written; not rendered |
| Semantic HTML, labels, skip link, error announcements, focus ring, reduced motion | NOT VERIFIED | Implemented in markup and CSS (code review); no assistive-technology or keyboard run |
| Contrast | NOT VERIFIED | Palette chosen for contrast; not measured |

## Testing requirements

| Requirement | Status |
| --- | --- |
| Unit: cart/price calculations, validation, payment states, order logic | PASS |
| Integration: auth, products, cart, checkout, orders, payments, admin authorization | PASS |
| E2E main journey, failed payment, unauthorized access, invalid checkout, insufficient inventory | PASS (HTTP-level against the production server) |
| E2E in a real browser | NOT VERIFIED (browser binaries could not be downloaded) |

## Deliverables

| Deliverable | Status |
| --- | --- |
| Code repository, GitHub-ready (`.gitignore`, `.env.example`, migrations, seed, no secrets, no `node_modules`) | PASS |
| README with all 19 required sections | PASS |
| Architecture and schema notes | PASS (`docs/ARCHITECTURE.md`) |
| Live demo URL | NOT VERIFIED: no hosting or database credentials available; deployment steps are in the README |
| Demo video | NOT VERIFIED: not recorded; script and checklist in `docs/DEMO-SCRIPT.md` |

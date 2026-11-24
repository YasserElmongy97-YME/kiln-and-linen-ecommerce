# Architecture

## Responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Pure domain logic | `src/lib` | Totals, order/payment state machines, validation schemas, formatting. No I/O, fully unit-tested |
| Services | `src/server` | Business rules, transactions, authorization-sensitive queries |
| HTTP | `src/app/api`, `src/server/http.ts` | Parse input, call a service, shape errors. Access level is declared per route |
| Pages | `src/app` | Server components read through services; forms are small client components calling `/api` |
| Data | `src/db`, `drizzle/` | Schema, connection pool, SQL migrations |

Key decisions:

- **One Next.js app, no microservices.** The domain is small; a separate backend would add deployment cost without benefit.
- **Money is integer cents everywhere.** Totals come from a single function (`calculateTotals`) used by cart, checkout and tests.
- **Server-side cart.** Cart rows live in PostgreSQL, so totals and stock checks cannot be tampered with from the browser.
- **Cookie sessions, not JWT.** Sessions can be revoked (logout deletes the row) and carry no claims a client could forge.
- **Archive instead of delete** for products, because order lines reference them.
- **Declarative access control.** Every route is created with `api({ access: "public" | "user" | "admin" }, handler)`. The wrapper applies rate limiting, the same-origin check, session lookup and role check before the handler runs, so a route cannot forget authorization by accident.

## Database schema

```
users 1──* sessions
users 1──1 carts 1──* cart_items *──1 products *──1 categories
users 1──* orders 1──* order_items *──1 products
                  1──* payments
```

| Table | Notable columns and constraints |
| --- | --- |
| `users` | `email` unique, `password_hash`, `role` enum (CUSTOMER, ADMIN) |
| `sessions` | `token_hash` unique (SHA-256 of the cookie token), `expires_at`, cascade on user delete |
| `categories` | `slug` unique, `name` |
| `products` | `slug` unique, `price_cents > 0` and `stock >= 0` CHECK constraints, `archived_at`, FK to category (restrict), indexes on category and price |
| `carts` / `cart_items` | one cart per user, unique `(cart_id, product_id)`, `quantity > 0` CHECK |
| `orders` | `status` enum, `subtotal_cents`, `shipping_cents`, `total_cents`, shipping snapshot columns, unique `(user_id, idempotency_key)`, indexes on user+date and status |
| `order_items` | snapshot of `product_name`, `image_url`, `unit_price_cents`, `quantity`; FK to product (restrict) |
| `payments` | `provider`, `reference` unique, `idempotency_key` unique, `status` enum, `amount_cents`, `card_last4`, `failure_reason` |

Snapshots are why changing a product's price or name later never alters past orders.

Transactions: order creation (lock cart, lock products, validate stock, insert order and items, decrement stock, clear cart), webhook application (lock payment and order rows), and admin status changes that restore stock and refund.

## Authentication and authorization

1. Register or login creates a random 256-bit token; the SHA-256 hash is stored in `sessions` and the raw token is sent in an `HttpOnly`, `SameSite=Lax` cookie valid for 14 days.
2. Each request resolves the cookie to a user (joining `sessions` and `users`, checking expiry).
3. Access levels: `public` (user optional), `user` (401 without a session), `admin` (403 unless `role = ADMIN`).
4. Customer order endpoints always filter by the session user id; another user's order is a 404.
5. Admin pages call `requireAdmin()` (anonymous users are sent to sign in, signed-in customers get a 404).
6. Admin accounts exist only via `npm run admin:create`. Registration always creates a CUSTOMER, regardless of extra fields in the request.

## Order and payment state

```
Order:   PENDING_PAYMENT ──(payment succeeded)──► PAID ──► PROCESSING ──► SHIPPED ──► DELIVERED
              │                                     │          │
              └──────────────── CANCELLED ◄─────────┴──────────┘     (admin; restores stock)

Payment: PENDING ──► SUCCEEDED ──► REFUNDED
            └──────► FAILED
```

- Admins may set only PROCESSING, SHIPPED, DELIVERED or CANCELLED, and only along allowed transitions. `PAID` can be reached only through a confirmed payment.
- Cancelling an order returns its stock and marks a succeeded payment as REFUNDED.

## Payment workflow

1. `POST /api/checkout` with an `Idempotency-Key`. The server re-reads the cart, locks products, checks stock, snapshots prices, creates the order and reserves stock. The same key returns the same order, including under concurrent requests.
2. `POST /api/orders/:id/pay` with a new `Idempotency-Key` per attempt and card details. The order must belong to the caller and be `PENDING_PAYMENT`.
   - The same key returns the stored payment (no second charge).
   - A payment row is inserted as PENDING with the order's total and a `sbx_…` reference.
   - The provider (`PaymentProvider.charge`) returns SUCCEEDED or FAILED.
3. The outcome becomes an event `{ id, type, reference, amountCents, failureReason? }`, signed with HMAC-SHA256 over the raw body (`X-Signature: sha256=<hex>`) and handled by `handleWebhook`, the same function behind `POST /api/payments/webhook`.
4. `handleWebhook` verifies the signature in constant time, validates the payload, then in one transaction locks the payment and order:
   - Payment no longer PENDING: no-op (replays are harmless).
   - Amount differs from the payment or order: rejected (400).
   - `payment.failed`: payment becomes FAILED; the order stays PENDING_PAYMENT so the customer can retry from the order page.
   - `payment.succeeded`: if the order is still PENDING_PAYMENT, payment becomes SUCCEEDED and the order PAID. Otherwise (paid by a racing attempt or cancelled) the payment is marked REFUNDED, so an order never keeps two successful charges.

A real provider would replace step 2's `charge` with a hosted or tokenized flow and send step 3's event to the public webhook URL; the verification, state machine and order logic stay as they are.

## Design system

Tokens live in `src/styles/tokens.css` (palette, type families, spacing, focus ring). The look is "premium editorial commerce": a pine-and-lichen palette with cobalt used only for keyboard focus, a serif display face over a system sans for body text, an asymmetric hero and staggered product grid, square product imagery, and no gradients or glass effects. Status is always written out in text, never conveyed by color alone. Motion is limited to image hover and a skeleton shimmer, and is disabled under `prefers-reduced-motion`.

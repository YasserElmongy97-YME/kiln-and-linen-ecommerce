# Demo walkthrough script (about 6 minutes)

No video has been recorded. Use this script and checklist to record one manually.

## Before recording

- [ ] `npm run db:reset && npm run db:migrate && npm run db:seed`
- [ ] `ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='demo-password-123' npm run admin:create`
- [ ] `npm run build && npm start`, open `http://localhost:3000` in a clean browser window (desktop width first)
- [ ] Have a second private window ready for the admin
- [ ] Hide bookmarks and notifications; set zoom to 100%

## Script

1. **Storefront (0:00)**: show the home page and the sandbox banner. Say that no real money moves.
2. **Browse and filter (0:40)**: open Shop. Search "vase", clear, filter to Lighting, set a price range, sort by price. Point out the stock badges and pagination.
3. **Product (1:30)**: open a product. Click Add to cart while signed out to show the redirect to sign in.
4. **Register (1:50)**: create an account. Land back on the product.
5. **Cart (2:10)**: add the item, raise the quantity until the stock limit message appears, change it back. Show the free shipping hint.
6. **Failed payment (2:50)**: checkout, enter an address, pay with `4000 0000 0000 0002`. Show the order page with the decline reason and the retry form.
7. **Successful payment (3:40)**: pay with `4242 4242 4242 4242`. Show the confirmation page, then Orders for the history and statuses.
8. **Permissions (4:20)**: in the second window sign in as a different customer and open the first customer's order URL (404). Open `/admin` (404).
9. **Admin (4:50)**: sign in as admin. Show the overview, edit a product's price and stock, create a product, open the Orders list, open the paid order and mark it processing then shipped.
10. **Mobile (5:40)**: resize to phone width and show the shop, cart and checkout.

## Recording checklist

- [ ] 1080p, microphone check, cursor visible
- [ ] Narrate the test cards before using them
- [ ] Show the URL bar when demonstrating the 404s
- [ ] Do not show the `.env` file or the admin password in the video

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://shop:shop@localhost:5432/shop_test";
process.env.PAYMENT_PROVIDER = "sandbox";
process.env.PAYMENT_WEBHOOK_SECRET = "test-webhook-secret-0123456789abcdef";
process.env.APP_URL = "http://localhost:3000";

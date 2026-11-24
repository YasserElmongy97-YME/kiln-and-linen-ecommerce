import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";
import { registerSchema } from "../src/lib/validation";
import { hashPassword } from "../src/server/auth";

const parsed = registerSchema.safeParse({
  name: process.env.ADMIN_NAME ?? "Store Admin",
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
if (!parsed.success) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 chars) in the environment, then run again.");
  process.exit(1);
}

const { name, email, password } = parsed.data;
const passwordHash = await hashPassword(password);
const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));

if (existing) {
  await db.update(users).set({ role: "ADMIN", passwordHash }).where(eq(users.id, existing.id));
  console.log(`Updated ${email}: role ADMIN, password replaced.`);
} else {
  await db.insert(users).values({ name, email, passwordHash, role: "ADMIN" });
  console.log(`Created admin ${email}.`);
}
await pool.end();

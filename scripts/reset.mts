import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database");
await db.execute(sql`drop schema if exists public cascade`);
await db.execute(sql`drop schema if exists drizzle cascade`);
await db.execute(sql`create schema public`);
await pool.end();
console.log("Database reset. Run `npm run db:migrate` next.");

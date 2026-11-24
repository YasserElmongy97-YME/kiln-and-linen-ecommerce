import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { call, createUser, emptyContext, PASSWORD, resetDb } from "../helpers";

const cookieOf = (setCookie: string | null) => setCookie!.split(";")[0]!;

beforeEach(resetDb);

describe("registration", () => {
  it("creates a customer, hashes the password and starts a session", async () => {
    const res = await call(register, "/api/auth/register", { body: { name: "Mona", email: "Mona@Example.com", password: PASSWORD } });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "mona@example.com", role: "CUSTOMER" });
    expect(res.setCookie).toMatch(/HttpOnly/);
    expect(res.setCookie).toMatch(/SameSite=Lax/);

    const [row] = await db.select().from(users).where(eq(users.email, "mona@example.com"));
    expect(row!.passwordHash).not.toContain(PASSWORD);
    expect(row!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("cannot be used to self-assign the admin role", async () => {
    const res = await call(register, "/api/auth/register", { body: { name: "Eve", email: "eve@example.com", password: PASSWORD, role: "ADMIN" } });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("CUSTOMER");
  });

  it("rejects duplicate emails and weak passwords", async () => {
    await createUser("dup@example.com");
    const dup = await call(register, "/api/auth/register", { body: { name: "Dup", email: "dup@example.com", password: PASSWORD } });
    expect(dup.status).toBe(409);
    const weak = await call(register, "/api/auth/register", { body: { name: "Weak", email: "weak@example.com", password: "short" } });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details.password).toBeDefined();
  });

  it("requires a JSON body", async () => {
    const res = await register(new Request("http://localhost:3000/api/auth/register", { method: "POST", body: "name=x" }), emptyContext);
    expect(res.status).toBe(415);
  });
});

describe("login and sessions", () => {
  it("logs in, identifies the user and logs out", async () => {
    await createUser("mona@example.com");
    const res = await call(login, "/api/auth/login", { body: { email: "mona@example.com", password: PASSWORD } });
    expect(res.status).toBe(200);
    const cookie = cookieOf(res.setCookie);

    expect((await call(me, "/api/auth/me", { cookie })).body.user.email).toBe("mona@example.com");
    await call(logout, "/api/auth/logout", { method: "POST", cookie });
    expect((await call(me, "/api/auth/me", { cookie })).body.user).toBeNull();
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await createUser("mona@example.com");
    const wrongPassword = await call(login, "/api/auth/login", { body: { email: "mona@example.com", password: "wrong-password" } });
    const unknownEmail = await call(login, "/api/auth/login", { body: { email: "nobody@example.com", password: "wrong-password" } });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it("rate limits repeated login attempts", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await call(login, "/api/auth/login", { body: { email: "x@example.com", password: "nope-nope-nope" } })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it("rejects cross-origin state-changing requests", async () => {
    const res = await call(login, "/api/auth/login", {
      body: { email: "a@example.com", password: "nope-nope-nope" },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("BAD_ORIGIN");
  });
});

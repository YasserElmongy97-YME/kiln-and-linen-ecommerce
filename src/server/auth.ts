import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "./session";

const ROUNDS = process.env.NODE_ENV === "test" ? 4 : 12;
// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, ROUNDS);

export async function registerUser(input: { name: string; email: string; password: string }): Promise<SessionUser> {
  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(users)
    .values({ name: input.name, email: input.email, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });
  if (!created) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
  return created;
}

export async function verifyLogin(email: string, password: string): Promise<SessionUser> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

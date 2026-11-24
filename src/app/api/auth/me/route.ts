import { api, json } from "@/server/http";

export const GET = api({ access: "public" }, async ({ user }) => json({ user }));

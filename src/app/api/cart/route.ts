import { api, json } from "@/server/http";
import { getCart } from "@/server/cart";

export const GET = api({ access: "user" }, async ({ user }) => json(await getCart(user.id)));

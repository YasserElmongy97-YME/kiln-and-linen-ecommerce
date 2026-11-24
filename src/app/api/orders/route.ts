import { api, json } from "@/server/http";
import { listOrders } from "@/server/orders";

export const GET = api({ access: "user" }, async ({ user }) => json({ orders: await listOrders({ userId: user.id }) }));

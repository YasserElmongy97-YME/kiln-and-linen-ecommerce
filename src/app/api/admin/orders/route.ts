import { z } from "zod";
import { api, json } from "@/server/http";
import { ORDER_STATUSES } from "@/lib/states";
import { listOrders } from "@/server/orders";

const filterSchema = z.object({ status: z.enum(ORDER_STATUSES).optional() });

export const GET = api({ access: "admin" }, async ({ req }) => {
  const { status } = filterSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json({ orders: await listOrders({ status }) });
});

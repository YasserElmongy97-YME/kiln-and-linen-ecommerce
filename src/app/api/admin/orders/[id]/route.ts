import { api, json, parseJson, requireUuidParam } from "@/server/http";
import { orderStatusSchema } from "@/lib/validation";
import { getOrderDetail, updateOrderStatus } from "@/server/orders";

export const GET = api({ access: "admin" }, async ({ params }) => {
  return json({ order: await getOrderDetail(requireUuidParam(params.id, "Order")) });
});

export const PATCH = api({ access: "admin" }, async ({ req, params }) => {
  const orderId = requireUuidParam(params.id, "Order");
  const { status } = await parseJson(req, orderStatusSchema);
  await updateOrderStatus(orderId, status);
  return json({ order: await getOrderDetail(orderId) });
});

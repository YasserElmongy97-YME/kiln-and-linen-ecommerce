import { api, json, requireUuidParam } from "@/server/http";
import { getOrderDetail } from "@/server/orders";

export const GET = api({ access: "user" }, async ({ user, params }) => {
  return json({ order: await getOrderDetail(requireUuidParam(params.id, "Order"), { userId: user.id }) });
});

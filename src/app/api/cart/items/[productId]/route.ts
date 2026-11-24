import { api, json, parseJson, requireUuidParam } from "@/server/http";
import { cartSetSchema } from "@/lib/validation";
import { getCart, removeFromCart, setCartQuantity } from "@/server/cart";

export const PATCH = api({ access: "user" }, async ({ req, user, params }) => {
  const productId = requireUuidParam(params.productId, "Product");
  const { quantity } = await parseJson(req, cartSetSchema);
  await setCartQuantity(user.id, productId, quantity);
  return json(await getCart(user.id));
});

export const DELETE = api({ access: "user" }, async ({ user, params }) => {
  await removeFromCart(user.id, requireUuidParam(params.productId, "Product"));
  return json(await getCart(user.id));
});

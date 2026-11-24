import { api, json, parseJson } from "@/server/http";
import { cartAddSchema } from "@/lib/validation";
import { addToCart, getCart } from "@/server/cart";

export const POST = api({ access: "user" }, async ({ req, user }) => {
  const { productId, quantity } = await parseJson(req, cartAddSchema);
  await addToCart(user.id, productId, quantity);
  return json(await getCart(user.id), 201);
});

import { api, json, parseJson } from "@/server/http";
import { productInputSchema } from "@/lib/validation";
import { createProduct, listAdminProducts } from "@/server/admin";

export const GET = api({ access: "admin" }, async () => json({ products: await listAdminProducts() }));

export const POST = api({ access: "admin" }, async ({ req }) => {
  const product = await createProduct(await parseJson(req, productInputSchema));
  return json({ product }, 201);
});

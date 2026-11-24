import { api, json, parseJson, requireUuidParam } from "@/server/http";
import { productPatchSchema } from "@/lib/validation";
import { getAdminProduct, updateProduct } from "@/server/admin";

export const GET = api({ access: "admin" }, async ({ params }) => {
  return json({ product: await getAdminProduct(requireUuidParam(params.id, "Product")) });
});

export const PATCH = api({ access: "admin" }, async ({ req, params }) => {
  const patch = await parseJson(req, productPatchSchema);
  return json({ product: await updateProduct(requireUuidParam(params.id, "Product"), patch) });
});

/** Products referenced by past orders cannot be hard-deleted, so DELETE archives them. */
export const DELETE = api({ access: "admin" }, async ({ params }) => {
  return json({ product: await updateProduct(requireUuidParam(params.id, "Product"), { archived: true }) });
});

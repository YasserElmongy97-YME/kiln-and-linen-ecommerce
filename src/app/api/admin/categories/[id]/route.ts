import { api, json, parseJson, requireUuidParam } from "@/server/http";
import { categoryInputSchema } from "@/lib/validation";
import { deleteCategory, renameCategory } from "@/server/admin";

export const PATCH = api({ access: "admin" }, async ({ req, params }) => {
  const { name } = await parseJson(req, categoryInputSchema);
  return json({ category: await renameCategory(requireUuidParam(params.id, "Category"), name) });
});

export const DELETE = api({ access: "admin" }, async ({ params }) => {
  await deleteCategory(requireUuidParam(params.id, "Category"));
  return json({ ok: true });
});

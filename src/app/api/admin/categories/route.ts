import { api, json, parseJson } from "@/server/http";
import { categoryInputSchema } from "@/lib/validation";
import { createCategory, listCategoriesWithCounts } from "@/server/admin";

export const GET = api({ access: "admin" }, async () => json({ categories: await listCategoriesWithCounts() }));

export const POST = api({ access: "admin" }, async ({ req }) => {
  const { name } = await parseJson(req, categoryInputSchema);
  return json({ category: await createCategory(name) }, 201);
});

import { api, json } from "@/server/http";
import { getProductBySlug } from "@/server/catalog";

export const GET = api({ access: "public" }, async ({ params }) => json({ product: await getProductBySlug(params.slug ?? "") }));

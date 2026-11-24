"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/client/api";
import { centsToDollars, dollarsToCents } from "@/lib/money";
import { FormMessage, SelectField, TextAreaField, TextField } from "../fields";

interface ProductValues {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
  categoryId: string;
  archived: boolean;
}

interface Props {
  categories: { id: string; name: string }[];
  product?: ProductValues;
}

export function ProductForm({ categories, product }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(request: () => Promise<unknown>, success: string) {
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      await request();
      setMessage({ tone: "ok", text: success });
      router.refresh();
    } catch (e) {
      const fieldErrors = e instanceof ApiError ? e.fieldErrors : {};
      setErrors(fieldErrors);
      setMessage({ tone: "error", text: Object.keys(fieldErrors).length ? "Check the highlighted fields." : e instanceof ApiError ? e.message : "Could not save the product." });
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      name: String(data.get("name")),
      description: String(data.get("description")),
      priceCents: dollarsToCents(String(data.get("price"))),
      stock: Number(data.get("stock")),
      imageUrl: String(data.get("imageUrl")),
      categoryId: String(data.get("categoryId")),
    };
    if (Number.isNaN(body.priceCents)) {
      setErrors({ priceCents: ["Enter a price like 24.50"] });
      setMessage({ tone: "error", text: "Check the highlighted fields." });
      return;
    }
    if (product) {
      await save(() => apiRequest(`/api/admin/products/${product.id}`, { method: "PATCH", body }), "Product saved.");
    } else {
      setPending(true);
      try {
        const { product: created } = await apiRequest<{ product: { id: string } }>("/api/admin/products", { body });
        router.push(`/admin/products/${created.id}`);
        router.refresh();
      } catch (e) {
        const fieldErrors = e instanceof ApiError ? e.fieldErrors : {};
        setErrors(fieldErrors);
        setMessage({ tone: "error", text: Object.keys(fieldErrors).length ? "Check the highlighted fields." : e instanceof ApiError ? e.message : "Could not create the product." });
        setPending(false);
      }
    }
  }

  const setArchived = (archived: boolean) =>
    save(() => apiRequest(`/api/admin/products/${product!.id}`, { method: "PATCH", body: { archived } }), archived ? "Product archived and hidden from the shop." : "Product restored to the shop.");

  return (
    <form onSubmit={onSubmit} className="stack product-form" noValidate>
      <div className="form-grid">
        <div className="span-2"><TextField name="name" label="Name" defaultValue={product?.name} required error={errors.name?.[0]} /></div>
        <div className="span-2"><TextAreaField name="description" label="Description" defaultValue={product?.description} required error={errors.description?.[0]} /></div>
        <TextField name="price" label="Price (USD)" inputMode="decimal" defaultValue={product ? centsToDollars(product.priceCents) : ""} required error={errors.priceCents?.[0]} />
        <TextField name="stock" label="Stock" type="number" min={0} step={1} defaultValue={product?.stock ?? 0} required error={errors.stock?.[0]} />
        <SelectField name="categoryId" label="Category" defaultValue={product?.categoryId ?? categories[0]?.id} error={errors.categoryId?.[0]}>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </SelectField>
        <TextField name="imageUrl" label="Image URL" defaultValue={product?.imageUrl ?? "/products/stoneware-mug.svg"} hint="An https address or a /path on this site." required error={errors.imageUrl?.[0]} />
      </div>
      <div role="status">{message?.tone === "ok" && <p className="alert alert-ok">{message.text}</p>}</div>
      <FormMessage message={message?.tone === "error" ? message.text : null} />
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>{product ? "Save changes" : "Create product"}</button>
        {product && (
          <button type="button" className={`btn ${product.archived ? "" : "btn-danger"}`} disabled={pending} onClick={() => setArchived(!product.archived)}>
            {product.archived ? "Restore to shop" : "Archive product"}
          </button>
        )}
      </div>
    </form>
  );
}

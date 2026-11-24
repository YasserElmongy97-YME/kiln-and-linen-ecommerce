"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/client/api";
import { FormMessage } from "../fields";

interface Category {
  id: string;
  name: string;
  productCount: number;
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(request: () => Promise<unknown>, reset?: HTMLFormElement) {
    setPending(true);
    setMessage(null);
    try {
      await request();
      reset?.reset();
      router.refresh();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Could not update categories.");
    } finally {
      setPending(false);
    }
  }

  const nameOf = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return String(new FormData(event.currentTarget).get("name") ?? "");
  };

  return (
    <div className="stack">
      <FormMessage message={message} />
      <form className="inline-form" onSubmit={(event) => { const form = event.currentTarget; const name = nameOf(event); void run(() => apiRequest("/api/admin/categories", { body: { name } }), form); }}>
        <label htmlFor="new-category" className="visually-hidden">New category name</label>
        <input id="new-category" name="name" className="input" placeholder="New category name" required minLength={2} maxLength={60} />
        <button type="submit" className="btn btn-primary" disabled={pending}>Add category</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Categories</caption>
          <thead><tr><th scope="col">Name</th><th scope="col" className="right">Products</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <form className="inline-form" onSubmit={(event) => { const name = nameOf(event); void run(() => apiRequest(`/api/admin/categories/${category.id}`, { method: "PATCH", body: { name } })); }}>
                    <label htmlFor={`name-${category.id}`} className="visually-hidden">Name of {category.name}</label>
                    <input id={`name-${category.id}`} name="name" className="input" defaultValue={category.name} required minLength={2} maxLength={60} />
                    <button type="submit" className="btn btn-small" disabled={pending}>Rename</button>
                  </form>
                </td>
                <td className="right num">{category.productCount}</td>
                <td className="right">
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    disabled={pending || category.productCount > 0}
                    title={category.productCount > 0 ? "Move or archive its products first" : undefined}
                    onClick={() => { if (window.confirm(`Delete the category "${category.name}"?`)) void run(() => apiRequest(`/api/admin/categories/${category.id}`, { method: "DELETE" })); }}
                  >
                    Delete<span className="visually-hidden"> {category.name}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

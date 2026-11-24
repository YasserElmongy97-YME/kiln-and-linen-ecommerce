"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, apiRequest, newIdempotencyKey } from "@/lib/client/api";
import { submitPayment } from "@/lib/client/payment";
import { COUNTRIES } from "@/lib/countries";
import { CardFields, readCard } from "./card-fields";
import { FormMessage, SelectField, TextField } from "./fields";

const SHIPPING_FIELDS = ["name", "phone", "line1", "city", "postalCode", "country"] as const;

export function CheckoutForm({ defaultName, totalLabel }: { defaultName: string; totalLabel: string }) {
  const router = useRouter();
  // One key per checkout screen: a double click or network retry returns the same order.
  const checkoutKey = useRef(newIdempotencyKey());
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const shipping = Object.fromEntries(SHIPPING_FIELDS.map((name) => [name, String(data.get(name) ?? "")]));

    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const { orderId } = await apiRequest<{ orderId: string }>("/api/checkout", { body: { shipping }, idempotencyKey: checkoutKey.current });
      const payment = await submitPayment(orderId, readCard(form));
      router.push(payment.status === "SUCCEEDED" ? `/orders/${orderId}/confirmation` : `/orders/${orderId}`);
      router.refresh();
    } catch (e) {
      if (!(e instanceof ApiError)) {
        setMessage("Something went wrong. Check your connection and try again.");
      } else {
        const fieldErrors = Object.fromEntries(Object.entries(e.fieldErrors).map(([key, value]) => [key.replace(/^shipping\./, ""), value]));
        setErrors(fieldErrors);
        setMessage(Object.keys(fieldErrors).length ? "Check the highlighted fields." : e.message);
        if (e.status === 409) router.refresh();
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack checkout-form" noValidate>
      <fieldset>
        <legend>Delivery</legend>
        <div className="form-grid">
          <div className="span-2"><TextField name="name" label="Full name" autoComplete="name" defaultValue={defaultName} required error={errors.name?.[0]} /></div>
          <TextField name="phone" label="Phone" type="tel" autoComplete="tel" required error={errors.phone?.[0]} />
          <SelectField name="country" label="Country" autoComplete="country" defaultValue="EG" error={errors.country?.[0]}>
            {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </SelectField>
          <div className="span-2"><TextField name="line1" label="Street address" autoComplete="address-line1" required error={errors.line1?.[0]} /></div>
          <TextField name="city" label="City" autoComplete="address-level2" required error={errors.city?.[0]} />
          <TextField name="postalCode" label="Postal code" autoComplete="postal-code" required error={errors.postalCode?.[0]} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Payment</legend>
        <div className="method">
          <input type="radio" id="method-card" name="method" value="card" defaultChecked />
          <label htmlFor="method-card">Test card <span className="muted">(sandbox, no real charge)</span></label>
        </div>
        <CardFields errors={errors} />
      </fieldset>

      <FormMessage message={message} />
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Processing payment…" : `Pay ${totalLabel} (test mode)`}</button>
    </form>
  );
}

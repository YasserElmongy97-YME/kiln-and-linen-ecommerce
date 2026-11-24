import { TextField } from "./fields";

export const CARD_FIELD_NAMES = ["cardName", "cardNumber", "expiry", "cvc"] as const;

/** Reads the card inputs rendered by CardFields from a submitted form. */
export function readCard(form: HTMLFormElement) {
  const data = new FormData(form);
  return Object.fromEntries(CARD_FIELD_NAMES.map((name) => [name, String(data.get(name) ?? "")]));
}

export function CardFields({ errors }: { errors: Record<string, string[]> }) {
  return (
    <div className="form-grid">
      <div className="span-2">
        <p className="alert">
          Sandbox payment. <strong>4242 4242 4242 4242</strong> succeeds, <strong>4000 0000 0000 0002</strong> is declined,{" "}
          <strong>4000 0000 0000 9995</strong> has insufficient funds. Use any future expiry and any 3 digit code.
        </p>
      </div>
      <div className="span-2">
        <TextField name="cardName" label="Name on card" autoComplete="cc-name" required error={errors.cardName?.[0]} />
      </div>
      <div className="span-2">
        <TextField name="cardNumber" label="Card number" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" required error={errors.cardNumber?.[0]} />
      </div>
      <TextField name="expiry" label="Expiry" autoComplete="cc-exp" placeholder="MM/YY" required error={errors.expiry?.[0]} />
      <TextField name="cvc" label="Security code" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required error={errors.cvc?.[0]} />
    </div>
  );
}

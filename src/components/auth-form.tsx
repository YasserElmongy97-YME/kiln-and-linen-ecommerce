"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, apiRequest, safeReturnPath } from "@/lib/client/api";
import { FormMessage, TextField } from "./fields";

const COPY = {
  login: { endpoint: "/api/auth/login", submit: "Sign in", busy: "Signing in…", switchText: "New here?", switchLink: "Create an account", switchHref: "/register" },
  register: { endpoint: "/api/auth/register", submit: "Create account", busy: "Creating account…", switchText: "Already have an account?", switchLink: "Sign in", switchHref: "/login" },
} as const;

export function AuthForm({ mode, next }: { mode: keyof typeof COPY; next?: string }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const destination = safeReturnPath(next);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      await apiRequest(copy.endpoint, { body: Object.fromEntries(data) });
      router.push(destination);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        setMessage(Object.keys(e.fieldErrors).length ? null : e.message);
      } else {
        setMessage("Something went wrong. Try again.");
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack auth-form" noValidate>
      {mode === "register" && <TextField name="name" label="Full name" autoComplete="name" required error={errors.name?.[0]} />}
      <TextField name="email" label="Email" type="email" autoComplete="email" required error={errors.email?.[0]} />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
        hint={mode === "register" ? "At least 10 characters." : undefined}
        error={errors.password?.[0]}
      />
      <FormMessage message={message} />
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? copy.busy : copy.submit}</button>
      <p className="small muted">
        {copy.switchText} <Link href={next ? `${copy.switchHref}?next=${encodeURIComponent(next)}` : copy.switchHref}>{copy.switchLink}</Link>
      </p>
    </form>
  );
}

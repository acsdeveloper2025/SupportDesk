"use client";

import { Button } from "@supportdesk/ui/button";
import { KeyRound, LogIn, Mail, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type FormState = "idle" | "submitting" | "success" | "error";

interface LoginValues {
  email: string;
  password: string;
  rememberMe: boolean;
  tenantSlug: string;
}

interface TenantEmailValues {
  email: string;
  tenantSlug: string;
}

interface TokenPasswordValues {
  password: string;
  token: string;
}

interface TokenValues {
  token: string;
}

export function AuthShell({
  children,
  eyebrow,
  title,
}: Readonly<{
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}>) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{title}</h1>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </section>
    </main>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectToParam = searchParams?.get("redirectTo");
  const [state, setState] = useState<FormState>("idle");
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LoginValues>({
    defaultValues: {
      rememberMe: false,
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          setState("submitting");

          try {
            await postWithCsrf("/api/auth/login", {
              email: values.email,
              password: values.password,
              rememberMe: values.rememberMe,
              tenant: {
                slug: values.tenantSlug,
              },
            });
            setState("success");

            const fallbackDestination = values.email.toLowerCase().includes("admin")
              ? "/admin"
              : "/tickets";
            const destination = getSafeRedirectPath(redirectToParam) ?? fallbackDestination;

            router.push(destination);
          } catch {
            setState("error");
          }
        })(event);
      }}
    >
      <TextField
        error={errors.tenantSlug?.message}
        label="Tenant slug"
        registration={register("tenantSlug", { required: "Tenant slug is required." })}
      />
      <TextField
        autoComplete="email"
        error={errors.email?.message}
        label="Email"
        registration={register("email", {
          pattern: {
            message: "Enter a valid email address.",
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          },
          required: "Email is required.",
        })}
        type="email"
      />
      <TextField
        autoComplete="current-password"
        error={errors.password?.message}
        label="Password"
        registration={register("password", { required: "Password is required." })}
        type="password"
      />
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <input
          className="h-4 w-4 rounded border-slate-300"
          type="checkbox"
          {...register("rememberMe")}
        />
        Remember me
      </label>
      <SubmitButton icon={<LogIn aria-hidden="true" size={18} />} loading={state === "submitting"}>
        Sign in
      </SubmitButton>
      <StatusMessage state={state} success="Signed in." />
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, setState] = useState<FormState>("idle");
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<TenantEmailValues>();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          setState("submitting");

          try {
            await postWithCsrf("/api/auth/password-reset/request", {
              email: values.email,
              tenant: {
                slug: values.tenantSlug,
              },
            });
            setState("success");
          } catch {
            setState("error");
          }
        })(event);
      }}
    >
      <TextField
        error={errors.tenantSlug?.message}
        label="Tenant slug"
        registration={register("tenantSlug", { required: "Tenant slug is required." })}
      />
      <TextField
        autoComplete="email"
        error={errors.email?.message}
        label="Email"
        registration={register("email", {
          pattern: {
            message: "Enter a valid email address.",
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          },
          required: "Email is required.",
        })}
        type="email"
      />
      <SubmitButton icon={<Mail aria-hidden="true" size={18} />} loading={state === "submitting"}>
        Send reset link
      </SubmitButton>
      <StatusMessage state={state} success="Request accepted." />
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, setState] = useState<FormState>("idle");
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<TokenPasswordValues>();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          setState("submitting");

          try {
            await postWithCsrf("/api/auth/password-reset/confirm", values);
            setState("success");
          } catch {
            setState("error");
          }
        })(event);
      }}
    >
      <TextField
        error={errors.token?.message}
        label="Reset token"
        registration={register("token", { required: "Reset token is required." })}
      />
      <TextField
        autoComplete="new-password"
        error={errors.password?.message}
        label="New password"
        registration={register("password", {
          minLength: {
            message: "Password must be at least 12 characters.",
            value: 12,
          },
          required: "New password is required.",
        })}
        type="password"
      />
      <SubmitButton
        icon={<KeyRound aria-hidden="true" size={18} />}
        loading={state === "submitting"}
      >
        Reset password
      </SubmitButton>
      <StatusMessage state={state} success="Password reset accepted." />
    </form>
  );
}

export function EmailVerificationForm() {
  const [state, setState] = useState<FormState>("idle");
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<TokenValues>();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          setState("submitting");

          try {
            await postWithCsrf("/api/auth/email-verification/confirm", values);
            setState("success");
          } catch {
            setState("error");
          }
        })(event);
      }}
    >
      <TextField
        error={errors.token?.message}
        label="Verification token"
        registration={register("token", { required: "Verification token is required." })}
      />
      <SubmitButton
        icon={<ShieldCheck aria-hidden="true" size={18} />}
        loading={state === "submitting"}
      >
        Verify email
      </SubmitButton>
      <StatusMessage state={state} success="Verification accepted." />
    </form>
  );
}

function TextField({
  autoComplete,
  error,
  label,
  registration,
  type = "text",
}: Readonly<{
  autoComplete?: string;
  error?: string;
  label: string;
  registration: ReturnType<typeof useForm>["register"] extends (...args: never[]) => infer R
    ? R
    : never;
  type?: string;
}>) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        autoComplete={autoComplete}
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
        id={id}
        type={type}
        {...registration}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function SubmitButton({
  children,
  icon,
  loading,
}: Readonly<{
  children: React.ReactNode;
  icon: React.ReactNode;
  loading: boolean;
}>) {
  return (
    <Button className="w-full" disabled={loading} type="submit">
      {icon}
      {children}
    </Button>
  );
}

function StatusMessage({ state, success }: Readonly<{ state: FormState; success: string }>) {
  useEffect(() => undefined, [state]);

  if (state === "idle" || state === "submitting") {
    return null;
  }

  return (
    <p className={state === "success" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
      {state === "success" ? success : "Request failed."}
    </p>
  );
}

async function postWithCsrf(path: string, body: unknown): Promise<unknown> {
  const csrfResponse = await fetch("/api/auth/csrf", {
    method: "GET",
  });
  const csrfBody = (await csrfResponse.json()) as { csrfToken?: string };
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfBody.csrfToken ?? "",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Auth request failed.");
  }

  return response.json();
}

function getSafeRedirectPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  try {
    const parsed = new URL(value, "http://supportdesk.local");
    if (parsed.origin !== "http://supportdesk.local") {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

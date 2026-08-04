import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailVerificationPage from "./(auth)/email-verification/page";
import ForgotPasswordPage from "./(auth)/forgot-password/page";
import LoginPage from "./(auth)/login/page";
import ResetPasswordPage from "./(auth)/reset-password/page";
import ProfilePage from "./profile/page";

const navigationMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMock.push,
    replace: navigationMock.replace,
  }),
  useSearchParams: () => navigationMock.searchParams,
}));

describe("authentication pages", () => {
  beforeEach(() => {
    navigationMock.push.mockReset();
    navigationMock.replace.mockReset();
    navigationMock.searchParams = new URLSearchParams();
    vi.unstubAllGlobals();
  });

  it("renders a tenant-aware login form and validates required fields", async () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tenant slug")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Remember me")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Tenant slug is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });

  it("renders forgot password, reset password, and email verification token forms", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("heading", { name: "Forgot password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tenant slug")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();

    render(<ResetPasswordPage />);
    expect(screen.getByRole("heading", { name: "Reset password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reset token")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();

    render(<EmailVerificationPage />);
    expect(screen.getByRole("heading", { name: "Verify email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Verification token")).toBeInTheDocument();
  });

  it("submits login through the same-origin BFF without exposing token storage", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(Response.json({ status: "authenticated" }));
    vi.stubGlobal("fetch", fetch);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Tenant slug"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "agent@acme.test" } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "CorrectHorse9!Battery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          body: JSON.stringify({
            email: "agent@acme.test",
            password: "CorrectHorse9!Battery",
            rememberMe: false,
            tenant: {
              slug: "acme",
            },
          }),
          headers: expect.objectContaining({
            "x-csrf-token": "csrf-token",
          }) as HeadersInit,
          method: "POST",
        }),
      ),
    );
    expect(await screen.findByText("Signed in.")).toBeInTheDocument();
  });

  it("rejects protocol-relative login redirect targets", async () => {
    navigationMock.searchParams = new URLSearchParams({
      redirectTo: "//evil.example/admin",
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(Response.json({ status: "authenticated" }));
    vi.stubGlobal("fetch", fetch);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Tenant slug"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "agent@acme.test" } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "CorrectHorse9!Battery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(navigationMock.push).toHaveBeenCalledWith("/tickets"));
  });
});

describe("profile page", () => {
  beforeEach(() => {
    navigationMock.push.mockReset();
    navigationMock.replace.mockReset();
    navigationMock.searchParams = new URLSearchParams();
    vi.unstubAllGlobals();
  });

  it("loads auth-scope identity fields from the current identity BFF route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            email: "agent@acme.test",
            preferences: {
              density: "compact",
            },
            profile: {
              displayName: "Acme Agent",
              language: "en",
              locale: "en-US",
              profilePicturePlaceholder: "AA",
              timeZone: "America/New_York",
            },
            roles: [
              {
                key: "agent",
                name: "Agent",
              },
            ],
            tenantId: "11111111-1111-4111-8111-111111111111",
          }),
        ),
      ),
    );

    render(<ProfilePage />);

    expect(await screen.findByDisplayValue("Acme Agent")).toBeInTheDocument();
    expect(screen.getByDisplayValue("America/New_York")).toBeInTheDocument();
    expect(screen.getByDisplayValue("en")).toBeInTheDocument();
    expect(screen.getByDisplayValue("en-US")).toBeInTheDocument();
    expect(screen.getByText("AA")).toBeInTheDocument();
    expect(screen.queryByText("Tickets")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});

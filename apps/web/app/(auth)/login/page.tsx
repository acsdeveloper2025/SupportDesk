import { Suspense } from "react";

import { AuthShell, LoginForm } from "../components/auth-forms";

export default function LoginPage() {
  return (
    <AuthShell eyebrow="SupportDesk" title="Sign in">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

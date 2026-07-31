import { AuthShell, ForgotPasswordForm } from "../components/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Forgot password">
      <ForgotPasswordForm />
    </AuthShell>
  );
}

import { AuthShell, ResetPasswordForm } from "../components/auth-forms";

export default function ResetPasswordPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Reset password">
      <ResetPasswordForm />
    </AuthShell>
  );
}

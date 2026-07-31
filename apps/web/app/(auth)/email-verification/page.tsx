import { AuthShell, EmailVerificationForm } from "../components/auth-forms";

export default function EmailVerificationPage() {
  return (
    <AuthShell eyebrow="Identity" title="Verify email">
      <EmailVerificationForm />
    </AuthShell>
  );
}

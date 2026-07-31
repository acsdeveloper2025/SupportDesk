import { AuthShell, LoginForm } from "../components/auth-forms";

export default function LoginPage() {
  return (
    <AuthShell eyebrow="SupportDesk" title="Sign in">
      <LoginForm />
    </AuthShell>
  );
}

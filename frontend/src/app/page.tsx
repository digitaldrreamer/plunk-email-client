import { EmailClient } from "@/components/email-client";
import { AuthGate } from "@/components/auth-gate";

export default function Home() {
  return (
    <AuthGate>
      <EmailClient />
    </AuthGate>
  );
}

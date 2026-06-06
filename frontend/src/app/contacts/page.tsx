"use client";

import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { ContactsPanel } from "@/components/contacts-panel";

export default function ContactsPage() {
  return (
    <AuthGate>
      <AppShell>
        <ContactsPanel />
      </AppShell>
    </AuthGate>
  );
}

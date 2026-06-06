"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEmailStore } from "@/store/email-store";
import { useAuthStore } from "@/store/auth-store";
import type { Email } from "@/data/emails";

export function useEmailStream() {
  const user = useAuthStore((s) => s.user);
  const addEmail = useEmailStore((s) => s.addEmail);
  const patchEmail = useEmailStore((s) => s.patchEmail);
  const removeEmail = useEmailStore((s) => s.removeEmail);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user) return;

    const connect = () => {
      // Same-origin request — Next.js proxies to backend, cookies sent automatically
      const es = new EventSource(`/api/emails/stream`, { withCredentials: true });
      esRef.current = es;

      es.addEventListener("new-email", (e) => {
        try {
          const email = JSON.parse(e.data) as Email;
          addEmail(email);
          if (email.folder === "inbox") {
            toast(`New email from ${email.from.name || email.from.email}`, {
              description: email.subject,
              duration: 5000,
            });
          }
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener("email-updated", (e) => {
        try {
          const patch = JSON.parse(e.data) as { id: string } & Partial<Email>;
          patchEmail(patch.id, patch);
        } catch { /* ignore */ }
      });

      es.addEventListener("email-deleted", (e) => {
        try {
          const { id } = JSON.parse(e.data) as { id: string };
          removeEmail(id);
        } catch { /* ignore */ }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Auto-reconnect after 5 s — EventSource usually handles this itself,
        // but we manually reconnect to ensure it works after longer gaps
        setTimeout(connect, 5_000);
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [user?.id]);
}

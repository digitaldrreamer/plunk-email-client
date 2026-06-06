import { useEmailStore, type Tag } from "@/store/email-store";

export type { Tag };

export function getTag(id: string): Tag | undefined {
  return useEmailStore.getState().tags.find((t) => t.id === id);
}

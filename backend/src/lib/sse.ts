import type { Response } from "express";

const clients = new Set<Response>();

export function addSseClient(res: Response): void {
  clients.add(res);
}

export function removeSseClient(res: Response): void {
  clients.delete(res);
}

export function sseEmit(event: string, data: unknown): void {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(chunk);
      // Flush past any TCP send-buffer / Nagle delay so the event arrives immediately
      (res as unknown as { flush?: () => void }).flush?.();
    } catch {
      clients.delete(res);
    }
  }
}

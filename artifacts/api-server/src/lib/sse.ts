import type { Response } from "express";

const clients = new Map<number, Response>();

export function addSseClient(userId: number, res: Response): void {
  const existing = clients.get(userId);
  if (existing) {
    try { existing.end(); } catch {}
  }
  clients.set(userId, res);
}

export function removeSseClient(userId: number): void {
  clients.delete(userId);
}

export function emitToUser(userId: number, event: string, data: Record<string, unknown>): void {
  const res = clients.get(userId);
  if (!res) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    clients.delete(userId);
  }
}

import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";

interface NotifyParams {
  userId: number;
  type: string;
  title: string;
  message: string;
  relatedOrderId?: number;
}

export async function notify(params: NotifyParams): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      isRead: false,
      relatedOrderId: params.relatedOrderId ?? null,
    });
  } catch {
    // Never throw — notification failure must not break main flow
  }
}

export async function notifyBoth(
  userId1: number,
  userId2: number,
  type: string,
  title: string,
  message: string,
  relatedOrderId?: number,
): Promise<void> {
  await Promise.all([
    notify({ userId: userId1, type, title, message, relatedOrderId }),
    notify({ userId: userId2, type, title, message, relatedOrderId }),
  ]);
}

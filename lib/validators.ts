import { z } from 'zod';

export const messageSchema = z.object({
  roomId: z.string().min(1),
  content: z.string().min(1).max(500),
});

export const typingSchema = z.object({
  isTyping: z.boolean(),
});

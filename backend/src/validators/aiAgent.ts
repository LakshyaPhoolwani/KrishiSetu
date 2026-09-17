import { z } from 'zod';

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().trim().max(100).optional(),
}).strict();

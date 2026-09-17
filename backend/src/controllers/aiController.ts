import type { Request, Response } from 'express';
import { chatWithAgent } from '../services/aiAgent.js';
import { chatRequestSchema } from '../validators/aiAgent.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const requestWindow = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

export const chat = async (request: Request, response: Response): Promise<void> => {
  const parsed = chatRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ success: false, error: { code: 'INVALID_CHAT_REQUEST', message: 'Chat request is invalid' } });
    return;
  }
  const context = (request as AuthenticatedRequest).authContext;
  if (!context) {
    response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  const now = Date.now();
  const existing = requestWindow.get(context.databaseUserId);
  if (!existing || now - existing.startedAt >= WINDOW_MS) {
    requestWindow.set(context.databaseUserId, { startedAt: now, count: 1 });
  } else if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    response.status(429).json({ success: false, error: { code: 'AI_RATE_LIMITED', message: 'Too many AI requests' } });
    return;
  } else {
    existing.count += 1;
  }
  try {
    const result = await chatWithAgent(parsed.data.message, context);
    response.json({ success: true, data: { ...result, conversationId: parsed.data.conversationId } });
  } catch (error) {
    const providerCode = error instanceof Error ? error.message : '';
    const code = providerCode === 'AI_NOT_CONFIGURED' || providerCode === 'AI_TOOL_LIMIT' ? providerCode : 'AI_REQUEST_FAILED';
    const status = code === 'AI_NOT_CONFIGURED' ? 503 : code === 'AI_TOOL_LIMIT' ? 429 : 502;
    response.status(status).json({ success: false, error: { code, message: status === 503 ? 'AI assistant is not configured' : status === 429 ? 'AI tool limit reached' : 'AI assistant is temporarily unavailable' } });
  }
};

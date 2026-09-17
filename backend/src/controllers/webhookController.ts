import type { Request, Response } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { z } from 'zod';
import {
  deactivateClerkUser,
  synchronizeCreatedOrUpdatedUser,
  type ClerkUserPayload,
} from '../services/userSync.js';

const userPayloadSchema = z.object({
  id: z.string().min(1),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  primary_email_address_id: z.string().nullable().optional(),
  email_addresses: z
    .array(z.object({ id: z.string(), email_address: z.string().email() }))
    .optional(),
  primary_phone_number_id: z.string().nullable().optional(),
  phone_numbers: z
    .array(z.object({ id: z.string(), phone_number: z.string() }))
    .optional(),
});

const webhookEventSchema = z.object({
  type: z.enum(['user.created', 'user.updated', 'user.deleted']),
  data: userPayloadSchema,
});

export const handleClerkWebhook = async (request: Request, response: Response): Promise<void> => {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    response.status(503).json({
      success: false,
      error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook verification is not configured' },
    });
    return;
  }

  let event: unknown;
  try {
    event = await verifyWebhook(request, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch {
    response.status(401).json({
      success: false,
      error: { code: 'INVALID_WEBHOOK', message: 'Webhook signature is invalid' },
    });
    return;
  }

  const parsed = webhookEventSchema.safeParse(event);
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      error: { code: 'INVALID_WEBHOOK_PAYLOAD', message: 'Webhook payload is invalid' },
    });
    return;
  }

  const payload = parsed.data.data as ClerkUserPayload;
  if (parsed.data.type === 'user.deleted') {
    await deactivateClerkUser(payload.id);
  } else {
    await synchronizeCreatedOrUpdatedUser(payload);
  }

  response.status(200).json({ success: true, data: { received: true } });
};

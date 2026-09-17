import { prisma } from './database.js';

export interface ClerkUserPayload {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_phone_number_id?: string | null;
  phone_numbers?: Array<{ id: string; phone_number: string }>;
}

const profileFromClerkUser = (payload: ClerkUserPayload) => {
  const email = payload.email_addresses?.find(
    (address) => address.id === payload.primary_email_address_id,
  )?.email_address;
  const phone = payload.phone_numbers?.find(
    (number) => number.id === payload.primary_phone_number_id,
  )?.phone_number;
  const name = [payload.first_name, payload.last_name].filter(Boolean).join(' ') || null;

  return { name, email: email ?? null, phone: phone ?? null };
};

export const synchronizeCreatedOrUpdatedUser = async (
  payload: ClerkUserPayload,
): Promise<void> => {
  const profile = profileFromClerkUser(payload);
  await prisma.user.upsert({
    where: { clerkUserId: payload.id },
    create: {
      clerkUserId: payload.id,
      ...profile,
      role: 'FARMER',
      status: 'ACTIVE',
    },
    update: profile,
  });
};

export const deactivateClerkUser = async (clerkUserId: string): Promise<void> => {
  await prisma.user.updateMany({
    where: { clerkUserId },
    data: { status: 'INACTIVE' },
  });
};

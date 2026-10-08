import { db } from '../lib/db';
import { customers } from '../models/schema';
import { eq, or } from 'drizzle-orm';

/** Guest phones are kept as 07XXXXXXXX, so "+250 788…", "0788 …" and "788…" are one guest. */
export function normalizeGuestPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('250') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.length === 9 && digits.startsWith('7')) return '0' + digits;
  return digits;
}

export const isRwandaMobile = (phone: string) => /^07[2389]\d{7}$/.test(normalizeGuestPhone(phone));

export async function findOrCreateCustomer(phone: string, name?: string) {
  const clean = normalizeGuestPhone(phone);
  // Older guests may be stored exactly as they typed it.
  const existing = await db.query.customers.findFirst({
    where: or(eq(customers.phone, clean), eq(customers.phone, phone)),
  });

  if (existing) {
    // Update name if provided and not already set
    if (name && !existing.name) {
      const [updated] = await db
        .update(customers)
        .set({ name })
        .where(eq(customers.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  const [customer] = await db
    .insert(customers)
    .values({ phone: clean || phone, name })
    .returning();

  return customer;
}

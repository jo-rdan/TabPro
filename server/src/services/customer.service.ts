import { db } from '../lib/db';
import { customers } from '../models/schema';
import { eq } from 'drizzle-orm';

export async function findOrCreateCustomer(phone: string, name?: string) {
  const existing = await db.query.customers.findFirst({
    where: eq(customers.phone, phone),
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
    .values({ phone, name })
    .returning();

  return customer;
}

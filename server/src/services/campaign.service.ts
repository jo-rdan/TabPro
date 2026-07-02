import { db } from "../lib/db";
import { campaigns, tabs, tables } from "../models/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function getAudience(venueId: string) {
  const venueTables = await db.query.tables.findMany({
    where: eq(tables.venueId, venueId),
  });

  const tableIds = venueTables.map((t) => t.id);
  if (tableIds.length === 0) return { count: 0, customers: [] };

  const allTabs = await db.query.tabs.findMany({
    with: { customer: true },
  });

  const venueTabs = allTabs.filter((t) => tableIds.includes(t.tableId));
  const seen = new Set<string>();
  const uniqueCustomers = venueTabs
    .map((t) => t.customer)
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

  return { count: uniqueCustomers.length, customers: uniqueCustomers };
}

export async function getCampaigns(venueId: string) {
  return db.query.campaigns.findMany({
    where: eq(campaigns.venueId, venueId),
    orderBy: [desc(campaigns.sentAt)],
  });
}

export async function createCampaign(venueId: string, message: string) {
  const [campaign] = await db
    .insert(campaigns)
    .values({ venueId, message, status: "draft" })
    .returning();
  return campaign;
}

export async function sendCampaign(campaignId: string, venueId: string) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "sent") throw new Error("Campaign already sent");

  const { customers: audience } = await getAudience(venueId);

  console.log(
    `[Campaign] Sending to ${audience.length} customers: "${campaign.message}"`,
  );

  const [updated] = await db
    .update(campaigns)
    .set({
      status: "sent",
      sentAt: new Date(),
      recipientCount: audience.length,
    })
    .where(eq(campaigns.id, campaignId))
    .returning();

  return { campaign: updated, recipientCount: audience.length };
}

export async function trackReturnVisit(venueId: string, customerId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentCampaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.venueId, venueId),
    orderBy: [desc(campaigns.sentAt)],
  });

  if (
    !recentCampaign ||
    recentCampaign.status !== "sent" ||
    !recentCampaign.sentAt
  )
    return;
  if (new Date(recentCampaign.sentAt) < thirtyDaysAgo) return;

  const venueTables = await db.query.tables.findMany({
    where: eq(tables.venueId, venueId),
  });
  const tableIds = venueTables.map((t) => t.id);

  const previousTab = await db.query.tabs.findFirst({
    where: eq(tabs.customerId, customerId),
  });

  if (!previousTab || !tableIds.includes(previousTab.tableId)) return;
  if (new Date(previousTab.openedAt) >= new Date(recentCampaign.sentAt)) return;

  await db
    .update(campaigns)
    .set({ returnVisits: sql`${campaigns.returnVisits} + 1` })
    .where(eq(campaigns.id, recentCampaign.id));
}

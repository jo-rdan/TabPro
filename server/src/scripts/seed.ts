import { db } from "../lib/db";
import {
  owners,
  venues,
  subscriptions,
  tables,
  qrStickers,
  menuItems,
} from "../models/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

async function seed() {
  console.log("🌱 Seeding Skuzi test data...\n");

  // ── Find the first owner in the database ──────────────────────────────────
  const allOwners = await db.select().from(owners).limit(2);
  if (allOwners.length === 0) {
    console.error(
      "❌ No owner found. Please log in via the app first, then run this script.",
    );
    process.exit(1);
  }

  const owner = allOwners[1];
  console.log(`✅ Owner found: ${owner.name} (${owner.email})`);

  // ── Find or create venue ──────────────────────────────────────────────────
  let existingVenues = await db
    .select()
    .from(venues)
    .where(eq(venues.ownerId, owner.id));

  let venue = existingVenues[0];

  if (!venue) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const [created] = await db
      .insert(venues)
      .values({
        ownerId: owner.id,
        name: "Chez Willy",
        location: "KG 7 Ave, Kigali",
        plan: "basic",
        trialEndsAt,
      })
      .returning();

    venue = created;

    await db.insert(subscriptions).values({
      venueId: venue.id,
      plan: "basic",
      status: "trialing",
    });

    console.log(`✅ Venue created: ${venue.name}`);
  } else {
    console.log(`✅ Venue found: ${venue.name}`);
  }

  // ── Create tables with QR stickers ───────────────────────────────────────
  const existingTables = await db
    .select()
    .from(tables)
    .where(eq(tables.venueId, venue.id));

  if (existingTables.length > 0) {
    console.log(`⏭️  Tables already exist — skipping table creation`);
  } else {
    const tableLabels = ["Table 1", "Table 2", "Table 3", "Table 4", "Table 5"];

    console.log("\n📋 Creating tables & QR stickers:");
    for (const label of tableLabels) {
      const [table] = await db
        .insert(tables)
        .values({ venueId: venue.id, label })
        .returning();

      const code = randomBytes(5).toString("hex");
      await db.insert(qrStickers).values({
        code,
        tableId: table.id,
        status: "claimed",
        claimedAt: new Date(),
      });

      console.log(`   ${label} → ${CLIENT_URL}/t/${code}`);
    }
  }

  // ── Seed menu items ───────────────────────────────────────────────────────
  const existingMenu = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.venueId, venue.id));

  if (existingMenu.length > 0) {
    console.log(`\n⏭️  Menu items already exist — skipping menu creation`);
  } else {
    const menu = [
      // Drinks
      {
        name: "Primus",
        category: "Drinks",
        priceRwf: 1500,
        description: "Rwanda's favourite local lager, crisp and refreshing",
      },
      {
        name: "Skol",
        category: "Drinks",
        priceRwf: 1500,
        description: "Light and smooth pilsner, perfect for any occasion",
      },
      {
        name: "Mutzig",
        category: "Drinks",
        priceRwf: 1500,
        description: "Premium Rwandan beer with a rich, full-bodied taste",
      },
      {
        name: "Coca-Cola",
        category: "Drinks",
        priceRwf: 1000,
        description: "Classic ice-cold Coca-Cola, always refreshing",
      },
      {
        name: "Fanta Orange",
        category: "Drinks",
        priceRwf: 1000,
        description: "Sparkling orange soda, sweet and fruity",
      },
      {
        name: "Water (500ml)",
        category: "Drinks",
        priceRwf: 500,
        description: "Still mineral water, chilled",
      },
      {
        name: "Juice (Mango)",
        category: "Drinks",
        priceRwf: 1500,
        description: "Fresh tropical mango juice, naturally sweet",
      },
      // Food
      {
        name: "Grilled Chicken",
        category: "Food",
        priceRwf: 5000,
        description:
          "Tender marinated chicken, charcoal-grilled to perfection. Served with chips and salad",
      },
      {
        name: "Brochettes (x5)",
        category: "Food",
        priceRwf: 3000,
        description:
          "Five skewers of seasoned beef, grilled over open flame with spices and peppers",
      },
      {
        name: "Chips",
        category: "Food",
        priceRwf: 2000,
        description: "Crispy golden fries, lightly salted. Served hot",
      },
      {
        name: "Chips + Egg",
        category: "Food",
        priceRwf: 2500,
        description: "Crispy fries topped with a fried egg, a Kigali favourite",
      },
      {
        name: "Grilled Tilapia",
        category: "Food",
        priceRwf: 6000,
        description:
          "Whole fresh tilapia, marinated and grilled. Served with ugali and vegetables",
      },
      {
        name: "Mixed Grill Platter",
        category: "Food",
        priceRwf: 8000,
        description:
          "A sharing platter of chicken, brochettes and sausage. Perfect for two",
      },
    ];

    await db
      .insert(menuItems)
      .values(menu.map((item) => ({ ...item, venueId: venue.id })));
    console.log(
      `\n✅ Menu items created: ${menu.length} items across Drinks & Food`,
    );
  }

  // ── Print QR URLs for testing ─────────────────────────────────────────────
  const allTables = await db
    .select({ label: tables.label, code: qrStickers.code })
    .from(tables)
    .leftJoin(qrStickers, eq(qrStickers.tableId, tables.id))
    .where(eq(tables.venueId, venue.id));

  console.log("\n─────────────────────────────────────────");
  console.log("🎉 Seed complete! Scan these URLs to test:\n");
  for (const t of allTables) {
    if (t.code)
      console.log(`  ${t.label.padEnd(10)} → ${CLIENT_URL}/t/${t.code}`);
  }
  console.log(`\n  Waiter view → ${CLIENT_URL}/waiter?venueId=${venue.id}`);
  console.log("─────────────────────────────────────────\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});

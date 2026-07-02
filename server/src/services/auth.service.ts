import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db';
import { owners, venues, subscriptions } from '../models/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

export function initPassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google'), undefined);

          // Find or create owner
          const existing = await db.query.owners.findFirst({
            where: eq(owners.googleId, profile.id),
          });

          if (existing) {
            return done(null, existing);
          }

          // Create new owner
          const [newOwner] = await db
            .insert(owners)
            .values({
              name: profile.displayName,
              email,
              googleId: profile.id,
            })
            .returning();

          return done(null, newOwner);
        } catch (err) {
          return done(err as Error, undefined);
        }
      }
    )
  );
}

export function signJwt(ownerId: string, email: string): string {
  return jwt.sign(
    { ownerId, email },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  );
}

// Create a venue for an owner (called after first Google login if no venue exists)
export async function createVenueForOwner(
  ownerId: string,
  name: string,
  location?: string
) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const [venue] = await db
    .insert(venues)
    .values({ ownerId, name, location, trialEndsAt })
    .returning();

  // Create a trialing subscription
  await db.insert(subscriptions).values({
    venueId: venue.id,
    plan: 'basic',
    status: 'trialing',
  });

  return venue;
}

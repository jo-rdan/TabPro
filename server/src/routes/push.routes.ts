import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { pushSubscriptions } from '../models/schema';
import { handleSubscribe, handleGetVapidKey, handleSubscribeTab } from '../controllers/push.controller';
import { venueMember, venueFromBody } from '../middleware/venueAccess.middleware';

const router = Router();

// Public — waiter subscribes without owner auth
router.post('/subscribe', venueMember(venueFromBody()), handleSubscribe);
router.get('/vapid-key', handleGetVapidKey);
// Public — a guest asks to be told when their order is ready
router.post('/subscribe-tab', handleSubscribeTab);
// Public — a phone's language changed (RW · EN · FR): its alerts follow. The
// push endpoint itself is the phone's secret, so no sign-in is needed.
router.post('/lang', async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  const lang = ['en', 'rw', 'fr'].includes(req.body?.lang) ? req.body.lang : null;
  if (!endpoint || !lang) { res.status(400).json({ success: false, error: 'endpoint and lang (en, rw or fr) are needed' }); return; }
  await db.update(pushSubscriptions).set({ lang }).where(eq(pushSubscriptions.endpoint, endpoint));
  res.json({ success: true, data: { lang } });
});

export default router;

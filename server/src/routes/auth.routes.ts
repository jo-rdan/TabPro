import { Router } from 'express';
import passport from 'passport';
import { googleCallback, getMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { siteFor, originOf } from '../lib/origins';

const router = Router();

// Step 1: Redirect to Google. We remember which of our sites they came from
// (?from=, else the page that sent them) and carry it through Google as state.
router.get('/google', (req, res, next) => {
  const from = typeof req.query.from === 'string' ? req.query.from : originOf(req.get('referer'));
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state: siteFor(from) })(req, res, next);
});

// Step 2: Google redirects back here
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/error' }),
  googleCallback
);

// Get current owner profile (protected)
router.get('/me', requireAuth, getMe);

export default router;

import { Router } from 'express';
import passport from 'passport';
import { googleCallback, getMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Step 1: Redirect to Google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Step 2: Google redirects back here
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/error' }),
  googleCallback
);

// Get current owner profile (protected)
router.get('/me', requireAuth, getMe);

export default router;

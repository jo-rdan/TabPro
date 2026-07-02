import { Router } from "express";
import authRoutes from "./auth.routes";
import venueRoutes from "./venue.routes";
import tableRoutes from "./table.routes";
import menuRoutes from "./menu.routes";
import tabRoutes from "./tab.routes";
import orderRoutes from "./order.routes";
import ratingRoutes from "./rating.routes";
import dashboardRoutes from "./dashboard.routes";
import staffRoutes from "./staff.routes";
import campaignRoutes from "./campaign.routes";
import subscriptionRoutes from "./subscription.routes";
import pushRoutes from "./push.routes";
import momoRoutes from "./momo.routes";
import shiftRoutes from "./shift.routes";
import clockinRoutes from "./clockin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/venues", venueRoutes);
router.use("/tables", tableRoutes);
router.use("/menu", menuRoutes);
router.use("/tabs", tabRoutes);
router.use("/orders", orderRoutes);
router.use("/ratings", ratingRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/staff", staffRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/push", pushRoutes);
router.use("/momo", momoRoutes);
router.use("/shifts", shiftRoutes);
router.use("/clockin", clockinRoutes);

// Phase 2+ routes will be added here:
// router.use('/venues', venueRoutes);
// router.use('/tables', tableRoutes);
// router.use('/menu', menuRoutes);
// router.use('/tabs', tabRoutes);
// router.use('/orders', orderRoutes);
// router.use('/staff', staffRoutes);
// router.use('/ratings', ratingRoutes);
// router.use('/campaigns', campaignRoutes);
// router.use('/subscriptions', subscriptionRoutes);

export default router;

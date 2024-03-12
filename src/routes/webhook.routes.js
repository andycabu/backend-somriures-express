import { Router } from "express";
import {
  verifyWebhook,
  webhookPost,
} from "../controllers/webhook.controller.js";

const router = Router();
router.get("/webhook", verifyWebhook);
router.post("/webhook", webhookPost);

export default router;

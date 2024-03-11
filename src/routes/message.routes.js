import { Router } from "express";
import {
  getAllMessagesByContactId,
  getUnreadMessagesCount,
  markReceivedMessagesAsRead,
  webhookPost,
} from "../controllers/message.controller.js";

const router = Router();

router.get("/messages/:contactId", getAllMessagesByContactId);
router.get("/messages/unread-count", getUnreadMessagesCount);
router.post("/messages/read", markReceivedMessagesAsRead);
router.post("/webhook", webhookPost);

export default router;

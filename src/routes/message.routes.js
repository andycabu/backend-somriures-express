import { Router } from "express";
import {
  getAllMessagesByContactId,
  getUnreadMessagesCount,
  markReceivedMessagesAsRead,
} from "../controllers/message.controller.js";

const router = Router();

router.get("/messages/:contactId/ById", getAllMessagesByContactId);
router.get("/messages/unread-count", getUnreadMessagesCount);
router.post("/messages/read", markReceivedMessagesAsRead);

export default router;

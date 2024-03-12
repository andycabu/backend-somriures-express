import { Router } from "express";
import {
  getContacts,
  saveSentMessage,
} from "../controllers/contact.controller.js";

const router = Router();

router.post("/saveMessage", saveSentMessage);
router.get("/getContacts", getContacts);

export default router;

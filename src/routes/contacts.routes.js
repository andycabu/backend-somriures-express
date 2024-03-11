import { Router } from "express";
import {
  getContacts,
  saveContactMessage,
} from "../controllers/contact.controller.js";

const router = Router();

router.post("/saveMessage", saveContactMessage);
router.get("/getContacts", getContacts);

export default router;

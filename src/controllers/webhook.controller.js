import {
  isValidIncomingMessage,
  TEMPLATE_NAMES,
  ACCESS_CONTROL,
  respondWithErrorMessage,
} from "../helpers/helpers.js";
import { saveContactMessage } from "./contact.controller.js";
import { PRUEBA_TOKEN } from "../utils/constants.js";
import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import { io } from "../app.js";
import { sendMessage } from "../controllers/contact.controller.js";

export const verifyWebhook = (req, res) => {
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];
  if (mode && token) {
    if (mode === "subscribe" && token === PRUEBA_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403);
    }
  }
};

export const webhookPost = async (req, res) => {
  const body = req.body;
  try {
    if (!isValidIncomingMessage(body)) {
      const response = respondWithErrorMessage(
        "Invalid incoming message format"
      );
      return res
        .status(response.statusCode)
        .set(response.headers)
        .send(response.body);
    }

    const changes = body.entry?.[0]?.changes;

    const hasIncomingMessage = changes?.some(
      (change) => change.field === "messages" && change.value?.messages
    );

    if (!hasIncomingMessage) {
      if (body?.entry[0].changes[0].value.statuses[0]) {
        const status = body?.entry[0].changes[0].value.statuses[0];
        const id = status.id;
        const newStatus = status.status;
        const existingMessage = await Message.findOne({ messageId: id });

        if (existingMessage.status !== "read") {
          await Message.updateOne({ messageId: id }, { status: newStatus });
          io.emit("newMessage", {
            messageId: id,
            newStatus: newStatus,
          });
        }
        return res.sendStatus(200);
      }
      return res.sendStatus(200);
    }

    const messageDetails = changes[0].value.messages[0];
    const existingMessage = await Contact.findOne({
      "messages.messageId": messageDetails.id,
    });
    if (existingMessage) {
      return res.sendStatus(200);
    } else {
      await saveContactMessage(body.entry[0]);
    }

    const recipientId = messageDetails.from;
    const templateName = messageDetails.metadata
      ? TEMPLATE_NAMES.CONFIRMATION
      : TEMPLATE_NAMES.DEFAULT;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientId,
      type: "template",
      // template: {
      //   name: templateName,
      //   language: {
      //     code: "es",
      //   },
      //   components: getTemplateComponents(messageDetails.metadata),
      // },
      type: "text",
      text: {
        preview_url: false,
        body: "prueba de recibir mensajes WhatsApp",
      },
    };

    const response = await sendMessage(data);

    return res.status(200).set(ACCESS_CONTROL).json(req.body);
  } catch (error) {
    console.error("Error processing message:", error);
    const response = respondWithErrorMessage(
      "Failed to process incoming message"
    );
    return res
      .status(response.statusCode)
      .set(response.headers)
      .send(response.body);
  }
};

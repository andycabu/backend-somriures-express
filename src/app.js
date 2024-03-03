"use strict";
import { config } from "dotenv";
config({ path: "../.env" });
import {
  URL,
  USER,
  PASS,
  ACCESS_TOKEN,
  FROM_PHONE_NUMBER_ID,
  PRUEBA_TOKEN,
} from "./utils/constants.js";
import { TEMPLATE_NAMES, ACCESS_CONTROL } from "./helpers/helpers.js";
import "./db/db.js";
import { Message } from "./models/Message.js";

const URL_WHAT = `https://graph.facebook.com/v19.0/${FROM_PHONE_NUMBER_ID}/messages`;

// Imports dependencies and set up http server
import express from "express";
import axios from "axios";

const app = express();
//Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Sets server port and logs message on success
app.listen(process.env.PORT || 3000, () => console.log("webhook is listening"));

// Función auxiliar para responder con mensajes de error
const respondWithErrorMessage = (message) => ({
  statusCode: 400,
  headers: ACCESS_CONTROL,
  body: JSON.stringify({ error: message }),
});

async function sendMessage(data) {
  try {
    return await axios.post(URL_WHAT, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });
  } catch (error) {
    throw new Error("Failed to send message through WhatsApp API");
  }
}
function isValidIncomingMessage(message) {
  if (!message || typeof message !== "object") {
    console.error(
      "Invalid message format: message is missing or not an object."
    );
    return false;
  }

  if (
    !message.entry ||
    !Array.isArray(message.entry) ||
    message.entry.length === 0
  ) {
    console.error(
      "Invalid message format: 'entry' property is missing or not an array."
    );
    return false;
  }

  const entry = message.entry[0];
  if (
    !entry ||
    !entry.changes ||
    !Array.isArray(entry.changes) ||
    entry.changes.length === 0
  ) {
    console.error(
      "Invalid message format: 'entry' object does not contain 'changes' array or it is empty."
    );
    return false;
  }

  return true;
}
const webhookPost = async (req, res) => {
  console.log("webhookPost: ", req.body);
  try {
    const incomingMessage = req.body;
    if (!isValidIncomingMessage(incomingMessage)) {
      const response = respondWithErrorMessage(
        "Invalid incoming message format"
      );
      return res
        .status(response.statusCode)
        .set(response.headers)
        .send(response.body);
    }

    const changes = incomingMessage.entry?.[0]?.changes;
    const hasIncomingMessage = changes?.some(
      (change) => change.field === "messages" && change.value?.messages
    );

    if (!hasIncomingMessage) {
      console.log("No new messages to process.");
      return res.status(200).set(ACCESS_CONTROL).json(req.body);
    }

    const messageDetails = changes[0].value.messages[0];
    const recipientId = messageDetails.from;

    const templateName = messageDetails.metadata
      ? TEMPLATE_NAMES.CONFIRMATION
      : TEMPLATE_NAMES.DEFAULT;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientId,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "es",
        },
        components: getTemplateComponents(messageDetails.metadata),
      },
    };

    const response = await sendMessage(data);
    console.log("WhatsApp API Response:", response.data);
    return res.status(200).set(ACCESS_CONTROL).json(response.data);
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

// Define la ruta del webhook y asocia el controlador
app.post("/webhook", webhookPost);

function getTemplateComponents(metadata) {
  if (metadata) {
    const { name, date, hour } = metadata;
    return [
      {
        type: "body",
        parameters: [
          { type: "text", text: name },
          { type: "text", text: date },
          { type: "text", text: hour },
        ],
      },
    ];
  }
  return [];
}

app.get("/webhook", (req, res) => {
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];
  if (mode && token) {
    if (mode === "subscribe" && token === PRUEBA_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

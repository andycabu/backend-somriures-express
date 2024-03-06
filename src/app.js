"use strict";
import { config } from "dotenv";
config({ path: "../.env" });
import express from "express";
import axios from "axios";
import { Server } from "socket.io";
import { createServer } from "node:http";
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
import Message from "./models/Message.js";

const URL_WHAT = `https://graph.facebook.com/v19.0/${FROM_PHONE_NUMBER_ID}/messages`;

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
app.use(express.json());

io.on("connection", (socket) => {
  console.log("a user connected");
});

app.use(express.urlencoded({ extended: false }));

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});

const respondWithErrorMessage = (message) => ({
  statusCode: 400,
  headers: ACCESS_CONTROL,
  body: JSON.stringify({ error: message }),
});

async function sendMessage(data) {
  try {
    const response = await axios.post(URL_WHAT, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });
    console.log("sendMessage: ", response);
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
async function saveSentMessage(change) {
  const messageDetails = change.value.statuses[0];
  const newMessage = new Message({
    direction: "sent",
    whatsappBusinessAccountId: change.id,
    messagingProduct: "whatsapp",
    metadata: messageDetails.metadata,
    messages: [
      {
        from: "Tu número de teléfono", // Aquí debes poner el número de teléfono desde el cual envías el mensaje
        messageId: messageDetails.id,
        timestamp: messageDetails.timestamp,
        status: messageDetails.status,
        recipientId: messageDetails.recipient_id,
        conversationId: messageDetails.conversation.id,
        conversationExpiration:
          messageDetails.conversation.expiration_timestamp,
        conversationOriginType: messageDetails.conversation.origin.type,
        pricing: messageDetails.pricing,
      },
    ],
    receivedAt: new Date(),
  });
  await newMessage.save();
}

async function saveReceivedMessage(message) {
  const messageDetails = message.changes[0].value.messages[0];
  const contacts = message.changes[0].value.contacts[0];
  const metadata = message.changes[0].value.metadata;

  const newMessage = new Message({
    direction: "received",
    whatsappBusinessAccountId: message.id,
    messagingProduct: "whatsapp",
    metadata: {
      displayPhoneNumber: metadata.display_phone_number,
      phoneNumberId: metadata.phone_number_id,
    },
    contacts: [
      {
        profile: {
          name: contacts.profile.name,
        },
        waId: contacts.wa_id,
      },
    ],
    messages: [
      {
        from: messageDetails.from,
        messageId: messageDetails.id,
        timestamp: messageDetails.timestamp,
        text: {
          body: messageDetails.text.body,
        },
        type: messageDetails.type,
      },
    ],
    receivedAt: new Date(),
  });
  await newMessage.save();
  // io.getIO().emit("mensaje", newMessage);
}

const getContacts = async (req, res) => {
  try {
    const mensajes = await Message.find({ direction: "received" }).exec();
    res.status(200).set(ACCESS_CONTROL).json(mensajes);
  } catch (error) {
    console.error("Error al obtener los mensajes:", error);
    res
      .status(500)
      .json({ error: "Error al obtener los mensajes del servidor" });
  }
};

app.get("/getContacts", getContacts);

const webhookPost = async (req, res) => {
  console.log("webhookPost: ", req.body);
  const body = req.body;
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

    console.log("hasIncomingMessage", hasIncomingMessage);
    if (!hasIncomingMessage) {
      console.log("No new messages to process.");
      return res.status(200).set(ACCESS_CONTROL).json(req.body);
    }

    const messageDetails = changes[0].value.messages[0];
    const existingMessage = await Message.findOne({
      "messages.messageId": messageDetails.id,
    });
    if (existingMessage) {
      console.log("el mensaje ya existe en la base de datos");
      return res.status(200).set(ACCESS_CONTROL).json(req.body);
    } else {
      console.log("el mensaje no existe en la base de datos");
      await saveReceivedMessage(body.entry[0]);
    }

    const recipientId = messageDetails.from;
    const templateName = messageDetails.metadata
      ? TEMPLATE_NAMES.CONFIRMATION
      : TEMPLATE_NAMES.DEFAULT;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientId,
      // type: "template",
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
      res.status(403);
    }
  }
});

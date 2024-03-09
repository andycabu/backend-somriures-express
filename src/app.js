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
import Contact from "./models/Contact.js";
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
  socket.emit("newMessage", { test: "Este es un mensaje de prueba" });
  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });
});

app.use(express.urlencoded({ extended: false }));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});

const respondWithErrorMessage = (message) => ({
  statusCode: 400,
  headers: ACCESS_CONTROL,
  body: JSON.stringify({ error: message }),
});

async function saveContactMessage(message) {
  if (message.changes?.length > 0) {
    const messageDetails = message.changes[0].value.messages[0];
    const contactDetails = message.changes[0].value.contacts[0];

    let contact = await Contact.findOne({
      "profile.waId": contactDetails.wa_id,
    });

    if (!contact) {
      contact = new Contact({
        profile: {
          name: contactDetails.profile.name,
          waId: contactDetails.wa_id,
        },
        receivedAt: new Date(),
      });
      await contact.save();
    }

    const newMessage = new Message({
      contactId: contact._id,
      from: messageDetails.from,
      messageId: messageDetails.id,
      timestamp: messageDetails.timestamp,
      text: { body: messageDetails.text.body },
      type: messageDetails.type,
      direction: "received",
    });

    await newMessage.save();
    io.emit("newMessage", { contactId: contact._id, message: newMessage });
  } else {
    const response = await sendMessage(message);
    let contact = await Contact.findOne({
      "profile.waId": response.contacts[0].wa_id,
    });
    const now = new Date();
    if (!contact) {
      existingContact = new Contact({
        profile: {
          name: "Unknown",
          waId: response.contacts[0].wa_id,
        },
        receivedAt: new Date(),
      });
      await contact.save();
    }

    const newMessage = new Message({
      contactId: contact._id,
      from: "15550155362",
      messageId: response.messages[0].id,
      timestamp: Math.floor(now.getTime() / 1000),
      text: {
        body: message.text.body,
      },
      type: "text",
      direction: "sent",
      status: "sent",
    });

    await newMessage.save();
    io.emit("newMessage", { contactId: contact._id, message: newMessage });
  }
}
app.post("/messages/read", async (req, res) => {
  const { contactId } = req.body;

  try {
    await Message.updateMany(
      { contactId: contactId, direction: "received", read: false },
      { $set: { read: true } }
    );

    res.json({ message: "Received messages marked as read." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error marking received messages as read.", error });
  }
});
// En tu archivo de rutas del servidor, añade una nueva ruta
app.get("/messages/unread-count", async (req, res) => {
  try {
    const unreadCounts = await Message.aggregate([
      { $match: { read: false, direction: "received" } },
      { $group: { _id: "$contactId", count: { $sum: 1 } } },
    ]);

    res.json(unreadCounts);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving unread messages count.", error });
  }
});

const saveSentMessage = async (req, res) => {
  try {
    const message = req.body;
    await saveContactMessage(message);
    return res.status(200).set(ACCESS_CONTROL).json(req.body);
  } catch (error) {
    console.error("Error al obtener los mensajes:", error);
  }
};

app.post("/saveMessage", saveSentMessage);

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

const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.aggregate([
      {
        $lookup: {
          from: "messages",
          localField: "_id",
          foreignField: "contactId",
          as: "messages",
        },
      },
      { $unwind: "$messages" },
      { $sort: { "messages.timestamp": -1 } },
      {
        $group: {
          _id: "$_id",
          lastMessage: { $first: "$messages" },
          contactInfo: { $first: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 1,
          profile: "$contactInfo.profile",
          lastMessage: 1,
        },
      },
    ]);

    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error al obtener los contactos:", error);
    res.status(500).json({
      error: "Error al obtener los contactos del servidor",
    });
  }
};

async function sendMessage(data) {
  try {
    const res = await axios.post(URL_WHAT, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });
    return res.data;
  } catch (error) {
    throw new Error("Failed to send message through WhatsApp API");
  }
}
const getAllMessagesByContactId = async (req, res) => {
  try {
    const { contactId } = req.params; // Asumiendo que pasas el ID del contacto en la URL

    // Encuentra la información del perfil del contacto
    const contact = await Contact.findById(contactId);

    // Encuentra los mensajes asociados al contacto
    const messages = await Message.find({ contactId: contactId }).sort({
      timestamp: -1, // Ordena los mensajes por timestamp de forma descendente
    });

    if (!contact) {
      return res.status(404).json({
        message: "No se encontró el contacto especificado.",
      });
    }

    if (messages.length > 0) {
      // Combinar la información del perfil con los mensajes en la respuesta
      const response = {
        profile: contact.profile, // Asumiendo que la información del perfil está bajo 'profile'
        messages: messages,
      };

      res.status(200).json(response);
    } else {
      // Si no hay mensajes, igualmente enviar el perfil del contacto
      res.status(404).json({
        profile: contact.profile,
        message: "No se encontraron mensajes para el contacto especificado.",
      });
    }
  } catch (error) {
    console.error("Error al obtener los mensajes del contacto:", error);
    res.status(500).json({
      error: "Error al obtener los mensajes del servidor",
    });
  }
};

app.get("/getContacts", getContacts);

app.get("/messages/:contactId", getAllMessagesByContactId);

const webhookPost = async (req, res) => {
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
        }
        return res.sendStatus(200);
      }
      console.log("No new messages to process.");
      return res.sendStatus(200);
    }

    const messageDetails = changes[0].value.messages[0];
    const existingMessage = await Contact.findOne({
      "messages.messageId": messageDetails.id,
    });
    if (existingMessage) {
      console.log("el mensaje ya existe en la base de datos");
      return res.sendStatus(200);
    } else {
      console.log("el mensaje no existe en la base de datos");
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

    // const response = await sendMessage(data);

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

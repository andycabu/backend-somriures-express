import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import axios from "axios";
import { URL_WHAT, ACCESS_TOKEN } from "../utils/constants.js";
import { ACCESS_CONTROL } from "../helpers/helpers.js";
import { io } from "../app.js";
export const sendMessage = async (data) => {
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
};
export const saveContactMessage = async (message) => {
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
      io.emit("newMessage", { newContact: contact });
    }

    const newMessage = new Message({
      contactId: contact._id,
      from: messageDetails.from,
      messageId: messageDetails.id,
      timestamp: messageDetails.timestamp,
      text: { body: messageDetails.text.body },
      type: messageDetails.type,
      direction: "received",
      read: false,
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
};

export const saveSentMessage = async (req, res) => {
  try {
    const message = req.body;
    await saveContactMessage(message);
    return res.status(200).set(ACCESS_CONTROL).json(req.body);
  } catch (error) {
    console.error("Error al obtener los mensajes:", error);
  }
};

export const getContacts = async (req, res) => {
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

import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import {
  isValidIncomingMessage,
  TEMPLATE_NAMES,
  ACCESS_CONTROL,
  respondWithErrorMessage,
} from "../helpers/helpers.js";

export const getAllMessagesByContactId = async (req, res) => {
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
export const getUnreadMessagesCount = async (req, res) => {
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
};

export const markReceivedMessagesAsRead = async (req, res) => {
  const { contactId } = req.body;

  try {
    const updateResult = await Message.updateMany(
      { contactId: contactId, direction: "received", read: false },
      { $set: { read: true } }
    );

    // Notificar al front-end que los mensajes han sido marcados como leídos
    if (updateResult.modifiedCount > 0) {
      io.emit("newMessage", { contactIdRead: contactId });
    }

    res.json({ message: "Received messages marked as read." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error marking received messages as read.", error });
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
        console.log(body?.entry[0]);
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

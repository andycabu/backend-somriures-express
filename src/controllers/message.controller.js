import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import { io } from "../app.js";
export const getAllMessagesByContactId = async (req, res) => {
  console.log(req.params);
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
  console.log("me ejecuto");
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

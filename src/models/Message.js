import { Schema, model } from "mongoose";

const messageSchema = new Schema({
  contactId: { type: Schema.Types.ObjectId, ref: "Contact" }, // Referencia al modelo de Contacto
  from: String,
  messageId: String,
  timestamp: String,
  text: {
    body: String,
  },
  type: { type: String, default: "text" },
  direction: { type: String, enum: ["sent", "received"], required: true },
  status: { type: String, default: "delivered" },
  read: { type: Boolean, default: false },
});

export default model("Message", messageSchema);

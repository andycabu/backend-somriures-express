import { Schema, model } from "mongoose";

const contactSchema = new Schema({
  direction: { type: String, enum: ["sent", "received"], required: true },
  whatsappBusinessAccountId: { type: String, required: true },
  messagingProduct: { type: String, default: "whatsapp" },
  status: { type: String, default: "pending" },
  metadata: {
    displayPhoneNumber: String,
    phoneNumberId: String,
  },
  contact: [
    {
      profile: {
        name: String,
      },
      waId: String,
    },
  ],
  messages: [
    {
      from: String,
      messageId: String,
      timestamp: String,
      text: {
        body: String,
      },
      type: { type: String, default: "text" },
    },
  ],
  receivedAt: { type: Date, default: Date.now },
});

contactSchema.index({ "contacts.waId": 1, receivedAt: -1 });

export default model("Contact", contactSchema);

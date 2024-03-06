import { Schema, model } from "mongoose";

const messageSchema = new Schema({
  direction: { type: String, enum: ["sent", "received"], required: true },
  whatsappBusinessAccountId: { type: String, required: true },
  messagingProduct: { type: String, default: "whatsapp" },
  metadata: {
    displayPhoneNumber: String,
    phoneNumberId: String,
  },
  contacts: [
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

messageSchema.index({ "contacts.waId": 1, receivedAt: -1 });

export default model("Message", messageSchema);

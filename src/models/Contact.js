import { Schema, model } from "mongoose";

const contactSchema = new Schema({
  profile: {
    name: String,
    waId: String,
  },
  receivedAt: { type: Date, default: Date.now },
});

contactSchema.index({ "profile.waId": 1, receivedAt: -1 });

export default model("Contact", contactSchema);

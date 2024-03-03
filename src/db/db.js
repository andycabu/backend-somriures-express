import { connect } from "mongoose";

import { MONGODB_URI_LOCAL } from "../utils/constants.js";

(async () => {
  try {
    const db = await connect(MONGODB_URI_LOCAL);
    console.log("DB is connected to:", db.connection.name);
  } catch (error) {
    console.log("Error connecting to DB:", error);
  }
})();

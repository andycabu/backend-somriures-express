"use strict";
import { config } from "dotenv";
config({ path: "../.env" });
import express from "express";
import { Server } from "socket.io";
import { createServer } from "node:http";
import contactRoutes from "./routes/contacts.routes.js";
import messageRoutes from "./routes/message.routes.js";
import { PRUEBA_TOKEN } from "./utils/constants.js";
import "./db/db.js";

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
app.use("/api", contactRoutes, messageRoutes);

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

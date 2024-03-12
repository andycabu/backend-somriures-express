"use strict";

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "dotenv";

import contactRoutes from "./routes/contacts.routes.js";
import messageRoutes from "./routes/message.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import "./db/db.js";

config({ path: "../.env" });

const app = express();
const server = createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

app.use("/api", webhookRoutes, contactRoutes, messageRoutes);

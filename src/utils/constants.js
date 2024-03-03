import { config } from "dotenv";
config({ path: "../.env" });

export const USER = process.env.USER_API;
export const PASS = process.env.PASSWORD_API;
export const URL = process.env.URL;
export const FROM_PHONE_NUMBER_ID = process.env.FROM_PHONE_NUMBER_ID;
export const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
export const PRUEBA_TOKEN = process.env.PRUEBA_TOKEN;
export const MONGODB_URI_LOCAL = process.env.MONGODB_URI_LOCAL;

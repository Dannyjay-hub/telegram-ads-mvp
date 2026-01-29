"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const grammy_1 = require("grammy");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const token = process.env.BOT_TOKEN;
if (!token) {
    console.warn('BOT_TOKEN is not defined in .env');
}
exports.bot = token ? new grammy_1.Bot(token) : null;

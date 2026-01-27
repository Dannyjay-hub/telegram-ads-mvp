import { Bot } from 'grammy';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;

if (!token) {
    console.warn('BOT_TOKEN is not defined in .env');
}

export const bot = token ? new Bot(token) : null;

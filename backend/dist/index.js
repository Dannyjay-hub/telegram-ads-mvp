"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_server_1 = require("@hono/node-server");
const hono_1 = require("hono");
const bot_1 = require("./bot");
const deals_1 = __importDefault(require("./routes/deals"));
const dotenv_1 = __importDefault(require("dotenv"));
const telegram_1 = require("./services/telegram");
dotenv_1.default.config();
const app = new hono_1.Hono();
// Enable CORS
app.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (c.req.method === 'OPTIONS') {
        return c.body(null, 204);
    }
    await next();
});
const channels_1 = __importDefault(require("./routes/channels"));
const auth_1 = __importDefault(require("./routes/auth"));
const briefs_1 = __importDefault(require("./routes/briefs"));
// Routes
app.route('/deals', deals_1.default);
app.route('/channels', channels_1.default);
app.route('/auth', auth_1.default);
app.route('/briefs', briefs_1.default);
app.get('/', (c) => c.text('Telegram Ad Marketplace Backend is Running!'));
// Dev endpoints to test mock services
app.get('/dev/chat-member', async (c) => {
    const res = await (0, telegram_1.getChatMember)(123, 456);
    return c.json(res);
});
app.get('/dev/channel-stats', async (c) => {
    const res = await (0, telegram_1.getChannelStats)(123);
    return c.json(res);
});
// Start Bot
// Run in background so it doesn't block
(0, bot_1.startBot)().catch(console.error);
// Start Server
const port = 3000;
console.log(`Server is running on port ${port}`);
(0, node_server_1.serve)({
    fetch: app.fetch,
    port
});

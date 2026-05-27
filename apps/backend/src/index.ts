import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { createApp } from "./app.js";

export type { AppType } from "./app.js";

const config = loadConfig();
const { db } = createDb(config.DATABASE_URL);
const { app } = createApp(config, db);

serve({ fetch: app.fetch, port: config.PORT }, ({ port }) => {
  console.log(`Payables API listening on http://localhost:${port}`);
});

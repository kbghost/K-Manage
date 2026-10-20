import mongoose from "mongoose";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { ensureTtlIndexes } from "./modules/auth/models.js";
import { ensureProductIndexes } from "./modules/catalog/models.js";

const env = loadEnv();
await mongoose.connect(env.MONGODB_URI);
await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
// Index avances (TTL des sessions, unicite partielle des codes-barres) : obligatoires sur MongoDB reel.
// Certains moteurs compatibles (ex. FerretDB, utilise pour des essais) ne les supportent pas : simple avertissement hors production.
for (const [name, create] of [["TTL sessions", ensureTtlIndexes], ["unicite des codes-barres", ensureProductIndexes]] as const) {
  try { await create(); } catch (e) {
    if (env.NODE_ENV === "production") throw e;
    console.warn(`Avertissement : index « ${name} » non cree (${e instanceof Error ? e.message.slice(0, 80) : "erreur"}). Acceptable en developpement uniquement.`);
  }
}
const app = createApp(env);
app.listen(env.PORT, () => console.log(`API K-Manage sur http://localhost:${env.PORT}/api/v1`));

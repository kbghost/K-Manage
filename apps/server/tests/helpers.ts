import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";

export const mongoUri = process.env.TEST_MONGODB_URI;
export const useTx = process.env.TEST_USE_TRANSACTIONS === "true";
let counter = 0;
export const uniq = () => `${Date.now()}${counter++}`;

export async function bootApp() {
  const dbName = `kmtest_${uniq()}`;
  const base = mongoUri!.replace(/\/[^/?]*(\?|$)/, `/${dbName}$1`);
  await mongoose.connect(base);
  const app = createApp(loadEnv({ NODE_ENV: "test", USE_TRANSACTIONS: String(useTx), DEV_EXPOSE_RESET_TOKEN: "true", UPLOAD_DIR: `/tmp/km-uploads-${dbName}`, CLIENT_ORIGIN: "http://localhost:5173" } as NodeJS.ProcessEnv));
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
  return { app, dbName, close: async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } };
}

/** Client HTTP avec cookie de session, jeton CSRF et commerce actif. */
export class Client {
  agent;
  csrf = "";
  businessId = "";
  constructor(public app: Parameters<typeof request.agent>[0]) { this.agent = request.agent(app); }
  async register(name: string) {
    const email = `${name}${uniq()}@test.bj`.toLowerCase();
    const r = await this.agent.post("/api/v1/auth/register").send({ email, password: "motdepasse-solide-1", fullName: name });
    this.csrf = r.body.data.csrfToken; this.email = email; this.userId = r.body.data.id;
    return this;
  }
  email = ""; userId = "";
  async login(email: string, password = "motdepasse-solide-1") {
    const r = await this.agent.post("/api/v1/auth/login").send({ email, password });
    this.csrf = r.body.data?.csrfToken ?? ""; return r;
  }
  use(businessId: string) { this.businessId = businessId; return this; }
  private h(t: request.Test, extra: Record<string, string> = {}) {
    t.set("x-csrf-token", this.csrf); if (this.businessId) t.set("x-business-id", this.businessId);
    for (const [k, v] of Object.entries(extra)) t.set(k, v); return t;
  }
  get(p: string) { return this.h(this.agent.get(`/api/v1${p}`)); }
  post(p: string, body: unknown = {}, headers: Record<string, string> = {}) { return this.h(this.agent.post(`/api/v1${p}`), headers).send(body as object); }
  patch(p: string, body: unknown = {}) { return this.h(this.agent.patch(`/api/v1${p}`)).send(body as object); }
  del(p: string) { return this.h(this.agent.delete(`/api/v1${p}`)); }
}

export async function newOwner(app: Parameters<typeof request.agent>[0], name = "Owner") {
  const c = await new Client(app).register(name);
  const b = await c.post("/businesses", { name: `Boutique ${name}` });
  c.use(b.body.data.id); return c;
}
export async function addStaff(app: Parameters<typeof request.agent>[0], owner: Client, role: "manager" | "cashier" | "storekeeper") {
  const c = await new Client(app).register(role);
  const r = await owner.post("/members", { email: c.email, role });
  if (r.status !== 201) throw new Error(`addStaff ${role}: ${r.status} ${JSON.stringify(r.body)}`);
  c.use(owner.businessId); return c;
}
export async function mkProduct(c: Client, o: Record<string, unknown> = {}) {
  const r = await c.post("/catalog/products", { name: "Produit", sku: `SKU${uniq()}`, costPrice: 600, salePrice: 1000, initialStock: 10, ...o });
  if (r.status !== 201) throw new Error(`mkProduct: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data as { id: string; stock: number };
}

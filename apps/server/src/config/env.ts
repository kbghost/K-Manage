import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/k-manage?replicaSet=rs0"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(168),
  USE_TRANSACTIONS: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  COOKIE_DOMAIN: z.string().optional(),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("K-Manage <no-reply@localhost>"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  DEV_EXPOSE_RESET_TOKEN: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  ALLOW_DEMO_SEED_IN_PRODUCTION: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  DEMO_SEED_PASSWORD: z.string().min(10).max(200).optional(),
}).superRefine((env, ctx) => {
  const cloudinaryValues = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET];
  if (cloudinaryValues.some(Boolean) && !cloudinaryValues.every(Boolean)) {
    ctx.addIssue({ code: "custom", message: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET doivent etre configures ensemble" });
  }
  if (env.NODE_ENV === "production" && !cloudinaryValues.every(Boolean)) {
    ctx.addIssue({ code: "custom", message: "Cloudinary est requis en production pour assurer la persistance des fichiers" });
  }
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = schema.parse(source);
  if (env.NODE_ENV === "production" && env.DEV_EXPOSE_RESET_TOKEN) {
    throw new Error("DEV_EXPOSE_RESET_TOKEN ne doit jamais etre actif en production");
  }
  if (env.NODE_ENV === "production" && !env.USE_TRANSACTIONS) {
    throw new Error("USE_TRANSACTIONS=false est interdit en production (coherence des ventes/stocks)");
  }
  return env;
}

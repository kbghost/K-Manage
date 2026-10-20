import { loadEnv } from "./env.js";
try {
  const e = loadEnv();
  console.log(`Configuration valide (mode ${e.NODE_ENV}, port ${e.PORT}).`);
} catch (err) {
  console.error("Configuration invalide :", err instanceof Error ? err.message : err);
  process.exit(1);
}

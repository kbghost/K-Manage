import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import type { Env } from "./config/env.js";
import { configureTransactions } from "./db/tx.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { buildOpenApi } from "./openapi.js";
import { adminRouter } from "./modules/admin/routes.js";
import { auditRouter } from "./modules/audit/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { businessesRouter } from "./modules/businesses/routes.js";
import { cashRouter } from "./modules/cash/routes.js";
import { catalogRouter } from "./modules/catalog/routes.js";
import { expensesRouter } from "./modules/expenses/routes.js";
import { membersRouter } from "./modules/members/routes.js";
import { partiesRouter } from "./modules/parties/routes.js";
import { purchasesRouter } from "./modules/purchases/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { salesRouter } from "./modules/sales/routes.js";
import { stockRouter } from "./modules/stock/routes.js";
import { uploadsRouter } from "./modules/uploads/routes.js";

export function createApp(env: Env) {
  configureTransactions(env.USE_TRANSACTIONS);
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false })); // l'API ne sert pas de HTML ; Swagger UI a besoin de scripts inline
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api/v1", rateLimit({ windowMs: 60_000, limit: env.NODE_ENV === "test" ? 100000 : 600, standardHeaders: true, legacyHeaders: false, message: { error: { code: "RATE_LIMITED", message: "Trop de requetes, patientez un instant" } } }));

  app.get("/api/v1/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
  app.get("/api/v1/openapi.json", (req, res) => res.json(buildOpenApi(`${req.protocol}://${req.get("host")}`)));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: "/api/v1/openapi.json" }));

  app.use("/api/v1/auth", authRouter(env));
  app.use("/api/v1/businesses", businessesRouter());
  app.use("/api/v1/members", membersRouter());
  app.use("/api/v1/catalog", catalogRouter());
  app.use("/api/v1/stock", stockRouter());
  app.use("/api/v1/sales", salesRouter());
  app.use("/api/v1/parties", partiesRouter());
  app.use("/api/v1/purchases", purchasesRouter());
  app.use("/api/v1/expenses", expensesRouter());
  app.use("/api/v1/cash-sessions", cashRouter());
  app.use("/api/v1/reports", reportsRouter());
  app.use("/api/v1/audit-logs", auditRouter());
  app.use("/api/v1/uploads", uploadsRouter(env));
  app.use("/api/v1/admin", adminRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

import type { Request, Response } from "express";
import { serialize } from "./serialize.js";
import { roleHasPermission, type Permission } from "@k-manage/shared";

export const send = (res: Response, data: unknown, status = 200, meta?: unknown) =>
  res.status(status).json({ data: serialize(data), ...(meta ? { meta } : {}) });

export const can = (req: Request, p: Permission) => !!req.tenant && roleHasPermission(req.tenant.role, p);

export const idParam = (req: Request, name = "id") => String(req.params[name]);

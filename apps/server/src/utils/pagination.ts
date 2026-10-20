/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Model } from "mongoose";
import { z } from "zod";

export const oid = z.string().regex(/^[a-f\d]{24}$/i, "identifiant invalide");

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Tri controle : seuls les champs de la liste blanche sont acceptes. */
export function sortSpec(sort: string | undefined, allowed: string[], fallback: string): Record<string, 1 | -1> {
  const raw = sort && allowed.includes(sort.replace(/^-/, "")) ? sort : fallback;
  return { [raw.replace(/^-/, "")]: raw.startsWith("-") ? -1 : 1, _id: -1 };
}

export async function paginate(
  model: Model<any>, filter: Record<string, any>, opts: { page: number; limit: number; sort: Record<string, 1 | -1> },
) {
  const [items, total] = await Promise.all([
    model.find(filter).sort(opts.sort).skip((opts.page - 1) * opts.limit).limit(opts.limit).lean(),
    model.countDocuments(filter),
  ]);
  return { items: items as any[], meta: { total, page: opts.page, limit: opts.limit, pages: Math.max(1, Math.ceil(total / opts.limit)) } };
}

export const dateRange = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

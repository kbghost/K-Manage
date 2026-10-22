import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import type { Env } from "../../config/env.js";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requireTenant } from "../../middleware/auth.js";
import { AppError, forbidden, notFound } from "../../utils/errors.js";
import { can, idParam, send } from "../../utils/http.js";
import { oid } from "../../utils/pagination.js";
import { Membership } from "../businesses/models.js";
import { Upload } from "./models.js";
import { cloudinaryConfigured, uploadToCloudinary } from "./cloudinary.js";

/** Type reel du fichier d'apres sa signature (jamais d'apres le nom ou le type declare par le client). */
export function sniff(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.length > 5 && buf.subarray(0, 5).toString() === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export function uploadsRouter(env: Env) {
  const r = Router();
  const dir = path.resolve(env.UPLOAD_DIR);
  const mu = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

  r.post("/", requireAuth, requireTenant, mu.single("file"), ah(async (req, res) => {
    if (!can(req, "products.update") && !can(req, "expenses.create") && !can(req, "settings.update")) throw forbidden();
    if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Aucun fichier recu");
    const kind = sniff(req.file.buffer);
    if (!kind) throw new AppError(415, "UNSUPPORTED_FILE", "Format non accepte (PNG, JPEG, WEBP ou PDF, 2 Mo max)");
    const businessId = req.tenant!.businessId;
    let filename = `${randomUUID()}.${kind.ext}`;
    let cloudinaryUrl: string | undefined;
    if (cloudinaryConfigured(env)) {
      const stored = await uploadToCloudinary(env, req.file.buffer, kind, String(businessId));
      filename = stored.publicId;
      cloudinaryUrl = stored.url;
    } else {
      await fs.mkdir(path.join(dir, String(businessId)), { recursive: true });
      await fs.writeFile(path.join(dir, String(businessId), filename), req.file.buffer, { flag: "wx" });
    }
    const u = await Upload.create({ businessId, userId: req.auth!.userId, filename, mime: kind.mime, size: req.file.size, cloudinaryUrl });
    send(res, { id: u.id, mime: u.mime, size: u.size }, 201);
  }));

  // Lecture : l'appartenance au commerce proprietaire du fichier est verifiee a chaque requete.
  r.get("/:id", requireAuth, ah(async (req, res) => {
    const u = await Upload.findById(oid.parse(idParam(req))).lean();
    const ok = u && (await Membership.exists({ businessId: u.businessId, userId: req.auth!.userId, status: "active" }));
    if (!u || !ok) throw notFound("Fichier introuvable");
    res.setHeader("Content-Type", u.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    if (u.cloudinaryUrl) {
      let remote: Response;
      try {
        remote = await fetch(u.cloudinaryUrl);
      } catch {
        throw new AppError(502, "MEDIA_STORAGE_UNAVAILABLE", "Le fichier est temporairement indisponible. Reessayez plus tard.");
      }
      if (!remote.ok) throw new AppError(502, "MEDIA_STORAGE_UNAVAILABLE", "Le fichier est temporairement indisponible. Reessayez plus tard.");
      res.send(Buffer.from(await remote.arrayBuffer()));
      return;
    }
    res.sendFile(path.join(dir, String(u.businessId), path.basename(u.filename)));
  }));
  return r;
}

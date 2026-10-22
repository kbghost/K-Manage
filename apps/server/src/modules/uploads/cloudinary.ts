import { createHash, randomUUID } from "node:crypto";
import type { Env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";

type CloudinaryConfig = Pick<Env, "CLOUDINARY_CLOUD_NAME" | "CLOUDINARY_API_KEY" | "CLOUDINARY_API_SECRET">;
type FileKind = { mime: string; ext: string };

export function cloudinaryConfigured(env: CloudinaryConfig): env is CloudinaryConfig & {
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
} {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function signature(params: Record<string, string>, secret: string) {
  const body = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("&");
  return createHash("sha1").update(`${body}${secret}`).digest("hex");
}

export async function uploadToCloudinary(env: CloudinaryConfig, buffer: Buffer, kind: FileKind, businessId: string) {
  if (!cloudinaryConfigured(env)) throw new AppError(503, "MEDIA_STORAGE_NOT_CONFIGURED", "Le stockage des fichiers n'est pas configure.");

  const resourceType = kind.mime === "application/pdf" ? "raw" : "image";
  const params = {
    folder: `k-manage/${businessId}`,
    public_id: `${randomUUID()}${resourceType === "raw" ? `.${kind.ext}` : ""}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const form = new FormData();
  form.set("api_key", env.CLOUDINARY_API_KEY);
  form.set("signature", signature(params, env.CLOUDINARY_API_SECRET));
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  const fileBytes = new Uint8Array(buffer.byteLength);
  fileBytes.set(buffer);
  form.set("file", new Blob([fileBytes], { type: kind.mime }), params.public_id);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/${resourceType}/upload`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new AppError(502, "MEDIA_STORAGE_UNAVAILABLE", "Impossible de joindre le stockage des fichiers. Reessayez plus tard.");
  }

  if (!response.ok) {
    throw new AppError(502, "MEDIA_STORAGE_FAILED", "Le stockage du fichier a echoue. Reessayez plus tard.");
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("secure_url" in data) || !("public_id" in data)
    || typeof data.secure_url !== "string" || !data.secure_url.startsWith("https://res.cloudinary.com/")
    || typeof data.public_id !== "string") {
    throw new AppError(502, "MEDIA_STORAGE_FAILED", "Le stockage du fichier a renvoye une reponse invalide.");
  }
  return { url: data.secure_url, publicId: data.public_id };
}

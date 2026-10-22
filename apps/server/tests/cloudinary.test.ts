import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadToCloudinary } from "../src/modules/uploads/cloudinary.js";

const env = {
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
};

afterEach(() => vi.unstubAllGlobals());

describe("stockage Cloudinary", () => {
  it("signe les parametres et televerse le media vers Cloudinary", async () => {
    let sentForm: FormData | undefined;
    let sentUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      sentUrl = String(url);
      sentForm = init?.body as FormData;
      return Response.json({ secure_url: "https://res.cloudinary.com/test-cloud/image/upload/example", public_id: "k-manage/b1/example" });
    }));

    const result = await uploadToCloudinary(env, Buffer.from("image"), { mime: "image/png", ext: "png" }, "b1");
    const params = Object.fromEntries(["folder", "public_id", "timestamp"].map((key) => [key, sentForm?.get(key) as string]));
    const canonical = Object.keys(params).sort().map((key) => `${key}=${params[key as keyof typeof params]}`).join("&");
    const expectedSignature = createHash("sha1").update(`${canonical}${env.CLOUDINARY_API_SECRET}`).digest("hex");

    expect(sentUrl).toBe("https://api.cloudinary.com/v1_1/test-cloud/image/upload");
    expect(sentForm?.get("api_key")).toBe(env.CLOUDINARY_API_KEY);
    expect(sentForm?.get("signature")).toBe(expectedSignature);
    expect(sentForm?.get("file")).toBeInstanceOf(Blob);
    expect(result).toEqual({ url: "https://res.cloudinary.com/test-cloud/image/upload/example", publicId: "k-manage/b1/example" });
  });

  it("utilise le type raw et l'extension pour un PDF", async () => {
    let sentForm: FormData | undefined;
    let sentUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      sentUrl = String(url);
      sentForm = init?.body as FormData;
      return Response.json({ secure_url: "https://res.cloudinary.com/test-cloud/raw/upload/example.pdf", public_id: "k-manage/b1/example.pdf" });
    }));

    await uploadToCloudinary(env, Buffer.from("%PDF-"), { mime: "application/pdf", ext: "pdf" }, "b1");
    expect(sentUrl).toBe("https://api.cloudinary.com/v1_1/test-cloud/raw/upload");
    expect(sentForm?.get("public_id")).toMatch(/\.pdf$/);
  });

  it("journalise uniquement le statut HTTP quand Cloudinary refuse un televersement", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("credentials rejected", { status: 401 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(uploadToCloudinary(env, Buffer.from("image"), { mime: "image/png", ext: "png" }, "b1"))
      .rejects.toMatchObject({ code: "MEDIA_STORAGE_FAILED", status: 502 });
    expect(log).toHaveBeenCalledWith("Cloudinary a refuse le televersement (HTTP 401).");
  });
});

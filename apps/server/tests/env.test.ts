import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

describe("configuration", () => {
  it("applique les valeurs par defaut", () => {
    expect(loadEnv({} as NodeJS.ProcessEnv).PORT).toBe(4000);
  });
  it("refuse l'exposition du jeton de reinitialisation en production", () => {
    expect(() => loadEnv({ NODE_ENV: "production", DEV_EXPOSE_RESET_TOKEN: "true" } as NodeJS.ProcessEnv)).toThrow();
  });
  it("refuse un port invalide", () => {
    expect(() => loadEnv({ PORT: "99999" } as NodeJS.ProcessEnv)).toThrow();
  });
  it("exige les trois identifiants Cloudinary ensemble", () => {
    expect(() => loadEnv({ CLOUDINARY_CLOUD_NAME: "cloud" } as NodeJS.ProcessEnv)).toThrow(/doivent etre configures ensemble/);
  });
  it("exige Cloudinary en production", () => {
    expect(() => loadEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/Cloudinary est requis en production/);
    expect(() => loadEnv({
      NODE_ENV: "production",
      CLOUDINARY_CLOUD_NAME: "cloud",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    } as NodeJS.ProcessEnv)).not.toThrow();
  });
});

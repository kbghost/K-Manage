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
});

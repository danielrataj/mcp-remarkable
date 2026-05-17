import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AuthStore } from "../src/auth-store.js";

describe("AuthStore", () => {
  it("writes and reads auth data without exposing the token in errors", async ({ task }) => {
    const dir = join(process.cwd(), "tmp-tests", task.id);
    const authPath = join(dir, "remarkable-auth.json");
    const store = new AuthStore(authPath);

    await store.write("secret-device-token");
    const raw = await readFile(authPath, "utf8");
    const data = await store.read();

    expect(JSON.parse(raw)).toMatchObject({ deviceToken: "secret-device-token" });
    expect(data.deviceToken).toBe("secret-device-token");
  });

  it("uses a readable message when auth is missing", async ({ task }) => {
    const store = new AuthStore(join(process.cwd(), "tmp-tests", task.id, "missing.json"));

    await expect(store.read()).rejects.toThrow("reMarkable účet není spárovaný.");
  });

  it("uses a readable message when auth is broken", async ({ task }) => {
    const dir = join(process.cwd(), "tmp-tests", task.id);
    await mkdir(dir, { recursive: true });
    const authPath = join(dir, "remarkable-auth.json");
    await writeFile(authPath, "{broken");
    await chmod(authPath, 0o600);

    const store = new AuthStore(authPath);
    await expect(store.read()).rejects.toThrow("Uložené přihlášení nejde přečíst.");
  });
});

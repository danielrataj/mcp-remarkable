import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

const AuthFileSchema = z.object({
  deviceToken: z.string().min(1),
  createdAt: z.string().datetime()
});

export type StoredAuth = z.infer<typeof AuthFileSchema>;

export class AuthStore {
  constructor(private readonly authPath: string) {}

  get path(): string {
    return this.authPath;
  }

  async read(): Promise<StoredAuth> {
    try {
      const raw = await readFile(this.authPath, "utf8");
      return AuthFileSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new Error("reMarkable účet není spárovaný. Nejdřív spusťte párování.");
      }

      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        throw new Error("Uložené přihlášení nejde přečíst. Spusťte párování znovu.");
      }

      throw error;
    }
  }

  async write(deviceToken: string): Promise<void> {
    const payload: StoredAuth = {
      deviceToken,
      createdAt: new Date().toISOString()
    };

    await mkdir(dirname(this.authPath), { recursive: true, mode: 0o700 });
    await writeFile(this.authPath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

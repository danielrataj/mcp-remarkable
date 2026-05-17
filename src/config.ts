import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function defaultAuthPath(): string {
  if (process.env.REMARKABLE_AUTH_PATH) {
    return process.env.REMARKABLE_AUTH_PATH;
  }

  if (existsSync("/data")) {
    return "/data/remarkable-auth.json";
  }

  return join(homedir(), ".config", "mcp-remarkable", "remarkable-auth.json");
}

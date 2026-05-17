import { register, remarkable, type CollectionEntry, type Entry, type RemarkableApi } from "rmapi-js";

import { AuthStore } from "./auth-store.js";
import type { RemarkableClient, UploadPdfInput, UploadPdfResult } from "./remarkable-client.js";

export class RmapiRemarkableClient implements RemarkableClient {
  constructor(private readonly authStore: AuthStore) {}

  async pair(code: string): Promise<void> {
    const normalizedCode = code.trim();
    if (!/^[A-Za-z0-9]{8}$/.test(normalizedCode)) {
      throw new Error("Zadejte osmimístný párovací kód z reMarkable účtu.");
    }

    const deviceToken = await register(normalizedCode, {
      deviceDesc: "browser-chrome"
    });
    await this.authStore.write(deviceToken);
  }

  async checkConnection(): Promise<{ itemCount: number }> {
    const api = await this.api();
    const items = await api.listItems(true);
    return { itemCount: items.length };
  }

  async uploadPdf(input: UploadPdfInput): Promise<UploadPdfResult> {
    const api = await this.api();
    let parent: string | undefined;
    if (input.destinationPath) {
      const destination = await findCollectionByPath(api, input.destinationPath);
      if (!destination) {
        throw new Error("Cílová složka v reMarkable nebyla nalezena.");
      }
      parent = destination.id;
    }

    const uploaded = await api.putPdf(input.title, input.bytes, parent ? { parent, refresh: true } : { refresh: true });

    return {
      id: uploaded.id,
      name: input.title
    };
  }

  private async api(): Promise<RemarkableApi> {
    const auth = await this.authStore.read();
    return remarkable(auth.deviceToken);
  }
}

async function findCollectionByPath(api: RemarkableApi, path: string): Promise<CollectionEntry | undefined> {
  const normalized = normalizeDestinationPath(path);
  if (normalized.length === 0) {
    return undefined;
  }

  const items = await api.listItems(true);
  let parent = "";
  let current: CollectionEntry | undefined;

  for (const segment of normalized) {
    current = items.find((item): item is CollectionEntry => {
      return item.type === "CollectionType" && item.parent === parent && item.visibleName === segment;
    });

    if (!current) {
      return undefined;
    }

    parent = current.id;
  }

  return current;
}

function normalizeDestinationPath(path: string): string[] {
  return path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

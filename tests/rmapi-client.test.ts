import { beforeEach, describe, expect, it, vi } from "vitest";
import { remarkable } from "rmapi-js";

import type { AuthStore } from "../src/auth-store.js";
import { RmapiRemarkableClient } from "../src/rmapi-client.js";

vi.mock("rmapi-js", () => ({
  register: vi.fn(),
  remarkable: vi.fn()
}));

describe("RmapiRemarkableClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads PDFs through the low-level putPdf path", async () => {
    const api = mockApi();
    vi.mocked(remarkable).mockResolvedValue(api);
    const client = new RmapiRemarkableClient(mockAuthStore());
    const bytes = new Uint8Array([1, 2, 3]);

    const result = await client.uploadPdf({
      title: "LLM výstup",
      bytes
    });

    expect(result).toEqual({ id: "doc-id", name: "LLM výstup" });
    expect(api.putPdf).toHaveBeenCalledWith("LLM výstup", bytes, { refresh: true });
    expect(api.uploadPdf).not.toHaveBeenCalled();
  });

  it("passes the destination folder directly to putPdf", async () => {
    const api = mockApi();
    api.listItems.mockResolvedValueOnce([
      {
        id: "folder-id",
        hash: "folder-hash",
        visibleName: "Inbox",
        lastModified: "0",
        pinned: false,
        parent: "",
        type: "CollectionType"
      }
    ]);
    vi.mocked(remarkable).mockResolvedValue(api);
    const client = new RmapiRemarkableClient(mockAuthStore());
    const bytes = new Uint8Array([1, 2, 3]);

    await client.uploadPdf({
      title: "LLM výstup",
      bytes,
      destinationPath: "Inbox"
    });

    expect(api.putPdf).toHaveBeenCalledWith("LLM výstup", bytes, {
      parent: "folder-id",
      refresh: true
    });
    expect(api.move).not.toHaveBeenCalled();
    expect(api.uploadPdf).not.toHaveBeenCalled();
  });
});

function mockAuthStore(): AuthStore {
  return {
    read: vi.fn().mockResolvedValue({ deviceToken: "device-token", createdAt: new Date().toISOString() })
  } as unknown as AuthStore;
}

function mockApi() {
  return {
    listItems: vi.fn().mockResolvedValue([]),
    putPdf: vi.fn().mockResolvedValue({ id: "doc-id", hash: "doc-hash" }),
    uploadPdf: vi.fn(),
    move: vi.fn()
  };
}

import { describe, expect, it, vi } from "vitest";

import { createRemarkableMcpServer } from "../src/server.js";
import type { RemarkableClient } from "../src/remarkable-client.js";

describe("MCP server", () => {
  it("creates a PDF from text and uploads it", async () => {
    const client = mockClient();
    const server = createRemarkableMcpServer({ client });
    const result = await callTool(server, "upload_text_as_pdf", {
      title: "LLM výstup",
      text: "Krátký text z ChatGPT pro čtení v reMarkable.\n\n- první bod\n- druhý bod",
      destinationPath: "Inbox"
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain("LLM výstup");
    expect(client.uploadPdf).toHaveBeenCalledWith({
      title: "LLM výstup",
      bytes: expect.any(Uint8Array),
      destinationPath: "Inbox"
    });
    const uploaded = vi.mocked(client.uploadPdf).mock.calls[0]?.[0];
    expect(Buffer.from(uploaded?.bytes.subarray(0, 5) ?? []).toString("ascii")).toBe("%PDF-");
  });

  it("does not expose local PDF file upload", () => {
    const client = mockClient();
    const server = createRemarkableMcpServer({ client });

    expect(getRegisteredTools(server).has("upload_pdf")).toBe(false);
    expect(getRegisteredTools(server).has("upload_text_as_pdf")).toBe(true);
  });

  it("returns a readable error when text PDF upload fails", async () => {
    const client = mockClient();
    vi.mocked(client.uploadPdf).mockRejectedValueOnce(new Error("Text se nepodařilo převést na PDF a nahrát."));
    const server = createRemarkableMcpServer({ client });
    const result = await callTool(server, "upload_text_as_pdf", { text: "Text k odeslání." });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Text se nepodařilo převést na PDF a nahrát.");
  });

  it("pairs and checks connection through the adapter", async () => {
    const client = mockClient();
    const server = createRemarkableMcpServer({ client });

    const pairResult = await callTool(server, "pair_remarkable", { code: "ABCDEFGH" });
    const checkResult = await callTool(server, "check_connection", {});

    expect(pairResult.isError).toBeFalsy();
    expect(checkResult.content[0]?.text).toContain("Nalezeno položek: 3");
    expect(client.pair).toHaveBeenCalledWith("ABCDEFGH");
    expect(client.checkConnection).toHaveBeenCalledOnce();
  });
});

function mockClient(): RemarkableClient {
  return {
    pair: vi.fn().mockResolvedValue(undefined),
    checkConnection: vi.fn().mockResolvedValue({ itemCount: 3 }),
    uploadPdf: vi.fn(async (input) => ({ id: "doc-id", name: input.title }))
  };
}

async function callTool(server: unknown, name: string, args: Record<string, unknown>) {
  const tool = getRegisteredTools(server).get(name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }
  return tool.handler(args, {});
}

type RegisteredTool = {
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  }>;
};

function getRegisteredTools(server: unknown): Map<string, RegisteredTool> {
  const maybeServer = server as { _registeredTools?: Map<string, RegisteredTool> | Record<string, RegisteredTool> };
  const tools = maybeServer._registeredTools;
  if (tools instanceof Map) {
    return tools;
  }
  if (tools && typeof tools === "object") {
    return new Map(Object.entries(tools));
  }
  throw new Error("Unable to inspect registered MCP tools.");
}

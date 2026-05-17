import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AuthStore } from "./auth-store.js";
import { defaultAuthPath } from "./config.js";
import { toUserMessage } from "./errors.js";
import { MAX_TEXT_PDF_CHARS, createPdfFromText } from "./pdf.js";
import type { RemarkableClient } from "./remarkable-client.js";
import { RmapiRemarkableClient } from "./rmapi-client.js";

export interface ServerOptions {
  client?: RemarkableClient;
  authPath?: string;
}

const UploadTextAsPdfSchema = {
  text: z.string().min(1).max(MAX_TEXT_PDF_CHARS).describe("Text that will be turned into a PDF."),
  destinationPath: z.string().min(1).optional().describe("Optional reMarkable folder path."),
  title: z.string().min(1).optional().describe("Optional document title shown on reMarkable.")
};

const PairSchema = {
  code: z.string().min(1).describe("Eight-character code from https://my.remarkable.com/device/browser/connect.")
};

export function createRemarkableMcpServer(options: ServerOptions = {}): McpServer {
  const authStore = new AuthStore(options.authPath ?? defaultAuthPath());
  const client = options.client ?? new RmapiRemarkableClient(authStore);

  const server = new McpServer({
    name: "mcp-remarkable",
    version: "0.1.0"
  });

  server.registerTool(
    "pair_remarkable",
    {
      title: "Pair reMarkable",
      description: "Save access to your reMarkable account using a pairing code.",
      inputSchema: PairSchema
    },
    async ({ code }) => {
      try {
        await client.pair(code);
        return textResult("reMarkable účet je spárovaný.");
      } catch (error) {
        return textResult(toUserMessage(error, "Párování se nepodařilo. Zkontrolujte kód a zkuste to znovu."), true);
      }
    }
  );

  server.registerTool(
    "check_connection",
    {
      title: "Check reMarkable Connection",
      description: "Check that saved reMarkable access works.",
      inputSchema: {}
    },
    async () => {
      try {
        const result = await client.checkConnection();
        return textResult(`Spojení funguje. Nalezeno položek: ${result.itemCount}.`);
      } catch (error) {
        return textResult(toUserMessage(error, "Spojení se nepodařilo ověřit. Zkontrolujte přihlášení a připojení."), true);
      }
    }
  );

  server.registerTool(
    "upload_text_as_pdf",
    {
      title: "Upload Text as PDF",
      description: "Create a PDF from text and upload it to your reMarkable cloud.",
      inputSchema: UploadTextAsPdfSchema
    },
    async ({ text, destinationPath, title }) => {
      try {
        const pdf = await createPdfFromText({ text, title });
        const result = await client.uploadPdf({
          title: pdf.title,
          bytes: pdf.bytes,
          destinationPath
        });

        return textResult(`PDF "${result.name}" bylo vytvořeno z textu a nahráno do reMarkable.`);
      } catch (error) {
        return textResult(toUserMessage(error, "Text se nepodařilo převést na PDF a nahrát."), true);
      }
    }
  );

  return server;
}

export function textResult(text: string, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text
      }
    ],
    isError
  };
}

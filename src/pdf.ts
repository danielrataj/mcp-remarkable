import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_TEXT_PDF_CHARS = 200_000;

const DEFAULT_REGULAR_FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial.ttf"
];
const DEFAULT_BOLD_FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/Library/Fonts/Arial Bold.ttf"
];

export interface TextPdfInput {
  text: string;
  title?: string | undefined;
}

export interface GeneratedPdf {
  title: string;
  bytes: Uint8Array;
}

export interface PdfFonts {
  regular: string;
  bold: string;
}

type TextBlock =
  | {
      type: "paragraph";
      lines: string[];
    }
  | {
      type: "list";
      listType: "bullet" | "numbered";
      items: string[];
    };

export async function createPdfFromText(input: TextPdfInput): Promise<GeneratedPdf> {
  const title = normalizeTitle(input.title ?? "Textový dokument");
  const text = normalizeText(input.text);

  const document = new PDFDocument({
    size: "A4",
    margin: 54,
    info: {
      Title: title,
      Creator: "mcp-remarkable"
    }
  });

  const chunks: Buffer[] = [];
  const finished = new Promise<Uint8Array>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const fonts = getPdfFonts();
  document.registerFont("DocumentRegular", fonts.regular);
  document.registerFont("DocumentBold", fonts.bold);

  document.font("DocumentBold").fontSize(20).text(title, {
    lineGap: 4
  });
  document.moveDown(0.8);
  document.font("DocumentRegular").fontSize(11);
  renderTextBlocks(document, parseTextBlocks(text));
  document.end();

  const bytes = await finished;
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("Vytvořené PDF je větší než povolených 100 MB.");
  }

  return {
    title,
    bytes
  };
}

export function parseTextBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraphLines: string[] = [];
  let activeList: Extract<TextBlock, { type: "list" }> | undefined;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const unordered = line.match(/^\s*(?:[-*+]|•)\s+(.+)$/u);
    if (unordered?.[1]) {
      flushParagraph();
      appendListItem("bullet", unordered[1].trim());
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/u);
    if (numbered?.[1]) {
      flushParagraph();
      appendListItem("numbered", numbered[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;

  function appendListItem(listType: "bullet" | "numbered", item: string): void {
    if (!activeList || activeList.listType !== listType) {
      flushList();
      activeList = {
        type: "list",
        listType,
        items: []
      };
    }
    activeList.items.push(item);
  }

  function flushParagraph(): void {
    if (paragraphLines.length === 0) {
      return;
    }
    blocks.push({
      type: "paragraph",
      lines: paragraphLines
    });
    paragraphLines = [];
  }

  function flushList(): void {
    if (!activeList) {
      return;
    }
    blocks.push(activeList);
    activeList = undefined;
  }
}

function renderTextBlocks(document: PDFKit.PDFDocument, blocks: TextBlock[]): void {
  for (const block of blocks) {
    if (block.type === "paragraph") {
      document.text(block.lines.join("\n"), {
        lineGap: 3,
        paragraphGap: 8
      });
      continue;
    }

    document.list(block.items, {
      listType: block.listType,
      bulletRadius: 2,
      bulletIndent: 10,
      textIndent: 20,
      lineGap: 3
    });
    document.moveDown(0.5);
  }
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized) {
    throw new Error("Název dokumentu nesmí být prázdný.");
  }
  return normalized;
}

function normalizeText(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    throw new Error("Text pro PDF nesmí být prázdný.");
  }
  if (normalized.length > MAX_TEXT_PDF_CHARS) {
    throw new Error("Text pro PDF je příliš dlouhý.");
  }
  return normalized;
}

export function getPdfFonts(): PdfFonts {
  return {
    regular: resolveFontPath("REMARKABLE_PDF_FONT_REGULAR", DEFAULT_REGULAR_FONT_CANDIDATES),
    bold: resolveFontPath("REMARKABLE_PDF_FONT_BOLD", DEFAULT_BOLD_FONT_CANDIDATES)
  };
}

function resolveFontPath(envName: string, candidates: string[]): string {
  const configured = process.env[envName];
  if (configured) {
    if (!existsSync(configured)) {
      throw new Error(`Nastavený font ${envName} neexistuje.`);
    }
    return configured;
  }

  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) {
    return found;
  }

  throw new Error("Nepodařilo se najít TTF font pro vytvoření PDF.");
}

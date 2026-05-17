import { describe, expect, it } from "vitest";

import { MAX_TEXT_PDF_CHARS, createPdfFromText, parseTextBlocks } from "../src/pdf.js";

describe("createPdfFromText", () => {
  it("creates a valid PDF from plain text", async () => {
    const result = await createPdfFromText({
      title: "Poznámky z ChatGPT",
      text: "Shrnutí\n\nToto je výstup z LLM, který chceme číst v reMarkable."
    });

    expect(result.title).toBe("Poznámky z ChatGPT");
    expect(Buffer.from(result.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    expect(result.bytes.byteLength).toBeGreaterThan(1000);
  });

  it("parses markdown bullet and numbered lists as PDF list blocks", () => {
    expect(
      parseTextBlocks(`Shrnutí

- první bod
- druhý bod

1. první krok
2. druhý krok`)
    ).toEqual([
      { type: "paragraph", lines: ["Shrnutí"] },
      { type: "list", listType: "bullet", items: ["první bod", "druhý bod"] },
      { type: "list", listType: "numbered", items: ["první krok", "druhý krok"] }
    ]);
  });

  it("creates a valid PDF from text with bullet lists", async () => {
    const result = await createPdfFromText({
      title: "Seznam úkolů",
      text: `Dnes vyřídit:

- Připravit podklady
- Odeslat dokument
- Zkontrolovat výsledek`
    });

    expect(Buffer.from(result.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    expect(result.bytes.byteLength).toBeGreaterThan(1000);
  });

  it("rejects blank text", async () => {
    await expect(createPdfFromText({ text: " \n\t " })).rejects.toThrow("Text pro PDF nesmí být prázdný.");
  });

  it("rejects text above the allowed limit", async () => {
    await expect(createPdfFromText({ text: "a".repeat(MAX_TEXT_PDF_CHARS + 1) })).rejects.toThrow(
      "Text pro PDF je příliš dlouhý."
    );
  });

  it("reports a readable error when a configured font is missing", async () => {
    const original = process.env.REMARKABLE_PDF_FONT_REGULAR;
    process.env.REMARKABLE_PDF_FONT_REGULAR = "/tmp/missing-remarkable-font.ttf";

    try {
      await expect(createPdfFromText({ text: "Text s češtinou: ěščřžýáíé." })).rejects.toThrow(
        "Nastavený font REMARKABLE_PDF_FONT_REGULAR neexistuje."
      );
    } finally {
      if (original === undefined) {
        delete process.env.REMARKABLE_PDF_FONT_REGULAR;
      } else {
        process.env.REMARKABLE_PDF_FONT_REGULAR = original;
      }
    }
  });
});

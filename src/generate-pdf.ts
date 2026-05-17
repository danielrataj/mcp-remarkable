#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { createPdfFromText, getPdfFonts } from "./pdf.js";

interface CliOptions {
  out?: string;
  title?: string;
  text?: string;
  help: boolean;
}

const options = parseArgs(process.argv.slice(2));

if (options.help || !options.out) {
  printUsage(options.out ? 0 : 1);
}

const text = options.text ?? (await readStdin());
if (!text.trim()) {
  console.error("Chyba: zadejte text přes --text nebo stdin.");
  printUsage(1);
}

const outputPath = resolve(options.out);
const pdf = await createPdfFromText({
  title: options.title,
  text
});
const fonts = getPdfFonts();

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, pdf.bytes);

console.log(`PDF vytvořeno: ${outputPath}`);
console.log(`Název: ${pdf.title}`);
console.log(`Velikost: ${pdf.bytes.byteLength} B`);
console.log(`Font regular: ${fonts.regular}`);
console.log(`Font bold: ${fonts.bold}`);

function parseArgs(args: string[]): CliOptions {
  const parsed: CliOptions = { help: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--out" || arg === "-o") {
      parsed.out = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--title" || arg === "-t") {
      parsed.title = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--text") {
      parsed.text = readValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Neznámý parametr: ${arg}`);
  }

  return parsed;
}

function readValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`Parametr ${name} potřebuje hodnotu.`);
  }
  return value;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  process.stdin.setEncoding("utf8");
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk;
  }
  return text;
}

function printUsage(exitCode: number): never {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Použití:
  npm run generate:pdf -- --out ./tmp/nahled.pdf --title "LLM výstup" --text "Text pro PDF"
  printf 'Text pro PDF\\nDruhý řádek' | npm run generate:pdf -- --out ./tmp/nahled.pdf --title "LLM výstup"

Volitelné proměnné:
  REMARKABLE_PDF_FONT_REGULAR=/cesta/font.ttf
  REMARKABLE_PDF_FONT_BOLD=/cesta/font-bold.ttf`);
  process.exit(exitCode);
}

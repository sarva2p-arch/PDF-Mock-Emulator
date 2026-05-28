import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

interface PdfTextItem {
  str?: string;
  transform?: number[];
}

interface PositionedText {
  x: number;
  y: number;
  text: string;
}

function findRow(rows: Map<number, PositionedText[]>, y: number) {
  for (const rowY of rows.keys()) {
    if (Math.abs(rowY - y) <= 2.5) return rowY;
  }
  return y;
}

function buildPageText(items: unknown[]) {
  const rows = new Map<number, PositionedText[]>();

  for (const rawItem of items) {
    const item = rawItem as PdfTextItem;
    const text = item.str?.trim();
    if (!text) continue;

    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    const rowY = findRow(rows, y);
    const row = rows.get(rowY) ?? [];
    row.push({ x, y: rowY, text });
    rows.set(rowY, row);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n");
}

export async function extractStructuredTextFromPdf(
  file: File,
  onPage: (pageNumber: number, totalPages: number) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    onPage(pageNum, pdf.numPages);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    pages.push(buildPageText(textContent.items));
  }

  return pages.join("\n\n");
}

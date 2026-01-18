// PDF.js text extraction utility
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source using the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type PdfTextItem = {
  str: string;
  transform?: number[];
};

function isTextItem(item: unknown): item is PdfTextItem {
  return Boolean(item) && typeof item === 'object' && 'str' in (item as any);
}

// Reconstruct line breaks from PDF text items by grouping them by Y position.
function pageItemsToTextLines(items: unknown[]): string {
  const positioned = items
    .filter(isTextItem)
    .map((item) => {
      const t = (item.transform ?? []) as number[];
      const x = typeof t[4] === 'number' ? t[4] : 0;
      const y = typeof t[5] === 'number' ? t[5] : 0;
      return {
        str: String(item.str ?? ''),
        x,
        y,
      };
    })
    .filter((i) => i.str.trim().length > 0);

  // Sort by visual reading order: top-to-bottom (higher y first), left-to-right.
  positioned.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
  const yTolerance = 2; // points; keeps same baseline together

  for (const item of positioned) {
    const last = lines[lines.length - 1];
    if (!last || Math.abs(item.y - last.y) > yTolerance) {
      lines.push({ y: item.y, parts: [{ x: item.x, str: item.str }] });
    } else {
      last.parts.push({ x: item.x, str: item.str });
    }
  }

  return lines
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        // Joining with spaces is OK because normalization collapses excess whitespace.
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = pageItemsToTextLines((textContent as any).items ?? []);
    fullText += pageText + '\n\n';
  }

  return fullText;
}

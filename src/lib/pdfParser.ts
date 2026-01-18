// PDF.js text extraction utility
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source using the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function extractTextFromPdf(file: File): Promise<string> {
  // Read file as array buffer
  const arrayBuffer = await file.arrayBuffer();
  
  // Load PDF document
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  // Extract text from each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Join text items with appropriate spacing
    const pageText = textContent.items
      .map((item: any) => {
        if ('str' in item) {
          return item.str;
        }
        return '';
      })
      .join(' ');
    
    fullText += pageText + '\n\n';
  }
  
  return fullText;
}

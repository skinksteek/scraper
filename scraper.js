import fetch from "node-fetch";
import * as pdfjsLib from "pdfjs-dist";

// Konfigurera PDF.js worker
import { GlobalWorkerOptions } from "pdfjs-dist";
GlobalWorkerOptions.workerSrc = "pdfjs-dist/build/pdf.worker.js"; // Använd .js istället för .mjs för denna version

const url = "https://example.com/sample.pdf"; // Ersätt med en giltig PDF-URL

async function extractPdfText(url) {
  try {
    // Hämta PDF-filen
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP-fel: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // Ladda PDF-dokumentet
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = "";

    // Loopa igenom sidorna
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    console.log(fullText);
  } catch (error) {
    console.error("Ett fel uppstod:", error);
  }
}

extractPdfText(url);

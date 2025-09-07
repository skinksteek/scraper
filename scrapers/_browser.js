import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// Sätter Chromium i headless mode (ingen grafisk vy)
chromium.setHeadlessMode = true;
// Stänger av grafik (spar resurser i serverless-miljö)
chromium.setGraphicsMode = false;

// Funktion som startar en browser, anpassad för både lokalt och serverless
export async function launchBrowser() {
  // Kollar om vi kör i serverless-miljö (t.ex. Vercel eller AWS Lambda)
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_REGION;

  // Startar Puppeteer med rätt inställningar beroende på miljö
  return await puppeteer.launch({
    headless: true, // Kör alltid utan grafiskt gränssnitt
    executablePath: isServerless ? await chromium.executablePath() : undefined, // Använd special-Chromium i serverless
    args: isServerless ? chromium.args : [], // Extra argument för serverless
    env:
      isServerless && chromium.environment
        ? { ...process.env, ...chromium.environment } // Lägg till miljövariabler för serverless
        : process.env,
  });
}

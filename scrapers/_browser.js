import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";

// Rekommenderade toggles för serverless
chromium.setHeadlessMode = true; // säkerställer headless
chromium.setGraphicsMode = false; // disable GPU/webgl

export async function launchBrowser() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_REGION;

  return await playwrightChromium.launch({
    headless: true,
    executablePath: isServerless ? await chromium.executablePath() : undefined,
    args: isServerless ? chromium.args : [],
  });
}

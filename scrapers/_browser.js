// scrapers/_browser.js
import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";

// Rekommenderade toggles för serverless
chromium.setHeadlessMode = true; // kör alltid headless
chromium.setGraphicsMode = false; // stäng av GPU

export async function launchBrowser() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_REGION;

  const executablePath = isServerless
    ? await chromium.executablePath()
    : undefined;
  const args = isServerless ? chromium.args : [];
  const env = isServerless ? chromium.environment : {};
  console.log("Using executable:", executablePath);
  console.log(
    "LD_LIBRARY_PATH starts with:",
    (env.LD_LIBRARY_PATH || "").slice(0, 60)
  );

  return await playwrightChromium.launch({
    headless: true,
    executablePath,
    args,
    // 👇 Viktigt: ger Chromium rätt LD_LIBRARY_PATH m.m.
    env: { ...process.env, ...env },
  });
}

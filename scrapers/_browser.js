// scrapers/_browser.js
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// säkerställ headless + ingen GPU i serverless
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

export async function launchBrowser() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_REGION;

  const executablePath = isServerless
    ? await chromium.executablePath()
    : undefined;
  const args = isServerless ? chromium.args : [];
  const env = isServerless ? chromium.environment : {};

  return await puppeteer.launch({
    headless: true,
    executablePath,
    args,
    env: { ...process.env, ...env }, // <-- viktigt för libnss3.so ett problem jag haft
  });
}

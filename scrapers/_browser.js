// scrapers/_browser.js
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

export async function launchBrowser() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_REGION;

  const executablePath = isServerless
    ? await chromium.executablePath()
    : undefined;
  const args = isServerless ? chromium.args : [];
  const env = isServerless ? chromium.environment : {};

  console.log("Using executable:", executablePath);
  console.log(
    "LD_LIBRARY_PATH prefix:",
    (env.LD_LIBRARY_PATH || "").slice(0, 40)
  );

  return await puppeteer.launch({
    headless: true,
    executablePath,
    args,
    env: { ...process.env, ...env }, // <- viktigt så libnss3 hittas
  });
}

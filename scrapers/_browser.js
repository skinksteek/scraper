import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

export async function launchBrowser() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_REGION;

  return await puppeteer.launch({
    headless: true,
    executablePath: isServerless ? await chromium.executablePath() : undefined,
    args: isServerless ? chromium.args : [],
    env:
      isServerless && chromium.environment
        ? { ...process.env, ...chromium.environment }
        : process.env,
  });
}

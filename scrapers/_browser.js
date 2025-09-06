import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";

export async function launchBrowser() {
  // På Vercel finns en headless Chromium med hjälp av @sparticuz/chromium
  const isServerless = !!process.env.AWS_REGION || !!process.env.VERCEL;
  return await playwrightChromium.launch({
    args: isServerless ? chromium.args : [],
    executablePath: isServerless ? await chromium.executablePath() : undefined,
    headless: isServerless ? chromium.headless : true,
  });
}

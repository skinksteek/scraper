// api/chrome-test.js
export const config = { runtime: "nodejs" };

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  try {
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      env: { ...process.env, ...chromium.environment },
    });

    const page = await browser.newPage();
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    const title = await page.title();

    await browser.close();
    res.status(200).json({ ok: true, title });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

import { chromium } from "playwright";
import { supabase } from "./lib/supabaseClient.js";
import "dotenv/config";

export default async function scrapeHemkop() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Går till Hemköps erbjudandesida och väntar tills sidan laddat klart sin HTML
  await page.goto("https://www.hemkop.se/artikel/alltid-bra-pris", {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  });
  let previousHeight = 0;

  // Startar en loop som körs tills inga fler produkter laddas in
  // loopen fortsätter att scrolla neråt för att ladda in samtliga produkter,
  //  tills att det inte går att scrolla mer
  while (true) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await page.waitForTimeout(3000);
  }

  const products = await page.$$eval(
    '[data-testid="vertical-product-container"]',
    (items) => {
      return items.map((item) => {
        const name =
          item
            .querySelector('[data-testid="product-title"]')
            ?.innerText.trim() ?? null;
        const volume =
          item
            .querySelector('[data-testid="display-volume"]')
            ?.innerText.trim()
            .replace(/(ca)(\d+)/g, "$1 $2") ?? null;
        const price =
          item.querySelector('[data-testid="price-text"]')?.innerText.trim() ??
          null;
        const compareOrdinaryPrice =
          item
            .querySelector(".sc-dec700a6-6")
            ?.innerText.replace(/[\n\r\t\\]/g, "") ?? null;

        const getMorePrice =
          item
            .querySelector(".sc-7337ea71-1")
            ?.innerText.replace(/[\n\r\t\\]/g, "")
            .replace(/(för)(\d+)/g, "$1 $2") ?? null;

        const imageURL = item.querySelector("img")?.src ?? null;
        return {
          name,
          price,
          store: "Hemköp",
          volume,
          getMorePrice,
          compareOrdinaryPrice,
          imageURL,
        };
      });
    }
  );
  const uniqueProducts = Array.from(
    new Map(products.map((p) => [`${p.name}|${p.volume}`, p])).values()
  );
  console.log(products.length);
  console.log(products.slice(0, 3));
  console.log("Antal innan dubblettkontroll:", products.length);
  console.log("Antal efter dubblettkontroll:", uniqueProducts.length);

  console.log(`Hemköp: ${uniqueProducts.length} unika produkter hittade`);

  await browser.close();
  return uniqueProducts;
}

scrapeHemkop().catch(console.error);

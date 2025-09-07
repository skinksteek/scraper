import { launchBrowser } from "./_browser.js";
import { parsePriceSv } from "./utils/price.js";

export default async function scrapeHemkop() {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(process.env.BOT_USER_AGENT || "SimpleScraper/1.0");
  if (process.env.BOT_FROM) {
    await page.setExtraHTTPHeaders({ From: process.env.BOT_FROM });
  }
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto("https://www.hemkop.se/veckans-erbjudanden", {
    timeout: 90_000,
    waitUntil: "domcontentloaded",
  });

  // Klicka på "Visa fler" tills alla produkter är laddade
  while (true) {
    const loadMore = await page.$('button:has-text("Visa fler")');
    if (!loadMore) break;

    const before = await page.$$eval(
      '[data-testid="vertical-product-container"]',
      (els) => els.length
    );

    await loadMore.click().catch(() => {});
    const loaded = await page
      .waitForFunction(
        (sel, prev) => document.querySelectorAll(sel).length > prev,
        {},
        '[data-testid="vertical-product-container"]',
        before
      )
      .catch(() => null);
    if (!loaded) break;
  }

  // Extrahera produkter
  const rawProducts = await page.$$eval(
    '[data-testid="vertical-product-container"]',
    (items) =>
      items.map((item) => {
        const q = (sel) => item.querySelector(sel);
        const qt = (sel) => q(sel)?.textContent?.trim() ?? null;

        return {
          name: qt('[data-testid="product-title"]'),
          volume: qt('[data-testid="display-volume"]'),
          priceText: qt('[data-testid="price-text"]'),
          compareOrdinaryPrice: qt('[data-testid="compare-price"]'),
          priceMultipleItems:
            Array.from(item.querySelectorAll("*"))
              .map((el) => el.textContent?.trim() || "")
              .find((t) => /\d+\s*f[öo]r/i.test(t)) || null,
          productURL: q("a")?.href || null,
          imageURL: q("img")?.src || null,
        };
      })
  );

  // Rensa + formatera
  const products = rawProducts.map((p) => ({
    name: p.name,
    volume: p.volume,
    price: parsePriceSv(p.priceText),
    compareOrdinaryPrice: p.compareOrdinaryPrice,
    priceMultipleItems: p.priceMultipleItems,
    productURL: p.productURL,
    imageURL: p.imageURL,
    store: "Hemköp",
  }));

  const uniqueProducts = Array.from(
    new Map(
      products.map((p) => [
        `${(p.name || "").toLowerCase()}|${p.volume || ""}`,
        p,
      ])
    ).values()
  );

  await browser.close();
  return uniqueProducts;
}

// scrapers/scrapeHemkop.js
import { launchBrowser } from "./_browser.js";
import { parsePriceSv } from "./utils/price.js";

export default async function scrapeHemkop() {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  // Lätt UA + headers (valfritt men bra etikett)
  await page.setUserAgent(process.env.BOT_USER_AGENT || "SimpleScraper/1.0");
  if (process.env.BOT_FROM) {
    await page.setExtraHTTPHeaders({ From: process.env.BOT_FROM });
  }

  await page.goto("https://www.hemkop.se/veckans-erbjudanden", {
    timeout: 90_000,
    waitUntil: "domcontentloaded",
  });

  // Klicka "Visa fler" tills inga fler produkter laddas
  while (true) {
    const before = await page.$$eval(
      '[data-testid="vertical-product-container"]',
      (els) => els.length
    );

    const buttons = await page.$x("//button[contains(., 'Visa fler')]");
    if (!buttons.length) break;

    await buttons[0].click().catch(() => {});
    // Vänta tills fler kort dyker upp eller avbryt om inget händer
    const grew = await page
      .waitForFunction(
        (sel, prev) => document.querySelectorAll(sel).length > prev,
        { timeout: 15_000 },
        '[data-testid="vertical-product-container"]',
        before
      )
      .then(() => true)
      .catch(() => false);

    if (!grew) break;
  }

  // Extrahera rådata från varje produktkort
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
          compareOrdinaryPrice: qt('[data-testid="compare-price"]') || null,
          priceMultipleItems:
            Array.from(item.querySelectorAll("*"))
              .map((el) => el.textContent?.trim() || "")
              .find((t) => /\d+\s*f[öo]r/i.test(t)) || null,
          productURL: q("a")?.href || null,
          imageURL: q("img")?.src || null,
        };
      })
  );

  // Mappa till ditt slutliga format
  const products = rawProducts.map((p) => {
    const abs = (href) => {
      try {
        return href ? new URL(href, "https://www.hemkop.se").href : null;
      } catch {
        return href || null;
      }
    };

    return {
      name: p.name,
      volume: p.volume,
      price: parsePriceSv(p.priceText),
      compareOrdinaryPrice: p.compareOrdinaryPrice,
      priceMultipleItems: p.priceMultipleItems,
      productURL: abs(p.productURL),
      imageURL: abs(p.imageURL),
      store: "Hemköp",
    };
  });

  // Deduplicera
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

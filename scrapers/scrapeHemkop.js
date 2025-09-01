import { chromium } from "playwright";
import { parsePriceSv } from "./utils/price.js";

export default async function scrapeHemkop() {
  const browser = await chromium.launch({ headless: true });

  const uaBase = process.env.BOT_USER_AGENT || "SimpleScraper/1.0";
  const from = process.env.BOT_FROM || "linusigelstrom@gmail.com";
  const note =
    process.env.BOT_COMMENT ||
    "Hobbyprojekt för att lära mig och förstå kod bättre, för att sedan försöka landa ett jobb";

  const context = await browser.newContext({
    userAgent: `${uaBase} (+mailto:${from}; purpose=${note}) Playwright`,
    extraHTTPHeaders: from ? { From: from } : {},
    locale: "sv-SE",
  });
  const page = await context.newPage();

  await page.goto("https://www.hemkop.se/veckans-erbjudanden", {
    timeout: 90000,
    waitUntil: "domcontentloaded",
  });
  // Hemköp gjorde om sin hemsida. Nu är det en "ladda fler"-knapp istället för att bara scrolla neråt.
  async function clickLoadMoreUntilDone(maxRounds = 200) {
    let prevCount = 0;
    for (let i = 0; i < maxRounds; i++) {
      // Räkna hur många produkter vi har just nu
      const beforeCount = await page.$$eval(
        '[data-testid="vertical-product-container"]',
        (els) => els.length
      );

      // Scrolla till botten så knappen renderas om den är lazy
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);

      // Hitta knappen
      const loadMore = page.getByRole("button", { name: /visa fler/i });
      const visible = await loadMore.isVisible().catch(() => false);
      const disabled = visible
        ? await loadMore.isDisabled().catch(() => false)
        : true;

      if (!visible || disabled) {
        // ingen mer knapp => klart
        break;
      }

      // Klicka och vänta på att fler kort dyker upp ELLER att knappen försvinner
      await Promise.all([
        loadMore.click(),
        // Vänta på att antalet produkter ökar eller timeout
        page
          .waitForFunction(
            (sel, prev) => document.querySelectorAll(sel).length > prev,
            { timeout: 15000 },
            '[data-testid="vertical-product-container"]',
            beforeCount
          )
          .catch(() => null),
      ]);

      // (Valfritt) ge nätverket lite andrum
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(300);

      const afterCount = await page.$$eval(
        '[data-testid="vertical-product-container"]',
        (els) => els.length
      );
      // Om inget ökar trots klick – prova ett varv till; om två varv i rad ingen ökning -> avbryt
      if (afterCount === beforeCount) {
        if (prevCount === afterCount) break;
      }
      prevCount = afterCount;
    }
  }

  await clickLoadMoreUntilDone();

  const rawProducts = await page.$$eval(
    '[data-testid="vertical-product-container"]',
    (items) =>
      items.map((item) => {
        const q = (sel) => item.querySelector(sel);
        const qt = (sel) => q(sel)?.textContent?.trim() ?? null;

        const name = qt('[data-testid="product-title"]');
        const volume =
          qt('[data-testid="display-volume"]')?.replace(
            /(ca)(\d+)/gi,
            "$1 $2"
          ) ?? null;

        const priceText = qt('[data-testid="price-text"]');

        const compareOrdinaryPrice =
          qt('[data-testid="compare-price"]') ||
          (Array.from(item.querySelectorAll("*"))
            .map((el) => el.textContent?.trim() || "")
            .find((t) => /^jfr\s*pris/i.test(t)) ??
            null);

        const priceMultipleItems =
          Array.from(item.querySelectorAll("*"))
            .map((el) => el.textContent?.trim() || "")
            .find((t) => /\d+\s*f[öo]r/i.test(t))
            ?.match(/\d+\s*f[öo]r/i)?.[0] ?? null;

        const a = q("a");
        const productURL = a ? a.href || a.getAttribute("href") : null;
        const img = q("img");
        const imageURL = img ? img.src || img.getAttribute("src") : null;

        return {
          name,
          volume,
          priceText,
          compareOrdinaryPrice,
          priceMultipleItems,
          productURL,
          imageURL,
        };
      })
  );

  // Parsar till rätt format för supabase med hjälp av parsePriceSv (./utils/price.js)
  const products = rawProducts.map((p) => {
    const price = parsePriceSv(p.priceText);
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
      price, // parsat värde
      compareOrdinaryPrice: p.compareOrdinaryPrice,
      priceMultipleItems: p.priceMultipleItems,
      productURL: abs(p.productURL),
      imageURL: abs(p.imageURL),
      store: "Hemköp",
    };
  });

  // Märkte att scrapingen fick i vissa fall med sig dubletter, detta förhindrar detta
  const uniqueProducts = Array.from(
    new Map(
      products.map((p) => [
        `${(p.name || "").toLowerCase()}|${p.volume || ""}`,
        p,
      ])
    ).values()
  );

  console.log(`Antal Hemköp produkter hittade: ${uniqueProducts.length}`);

  await context.close();
  await browser.close();
  return uniqueProducts;
}

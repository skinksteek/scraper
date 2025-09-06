import { launchBrowser } from "./_browser.js";
import { parsePriceSv } from "./utils/price.js";

export default async function scrapeHemkop() {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  // headers/UA i Puppeteer:
  await page.setUserAgent(
    `${process.env.BOT_USER_AGENT || "SimpleScraper/1.0"} Playwright`
  );
  if (process.env.BOT_FROM) {
    await page.setExtraHTTPHeaders({ From: process.env.BOT_FROM });
  }
  // locale: sätt via emulate
  await page.emulateTimezone("Europe/Stockholm"); // valfritt
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto("https://www.hemkop.se/veckans-erbjudanden", {
    timeout: 90_000,
    waitUntil: "domcontentloaded",
  });

  async function clickLoadMoreUntilDone(maxRounds = 200) {
    let prevCount = 0;
    for (let i = 0; i < maxRounds; i++) {
      const beforeCount = await page.$$eval(
        '[data-testid="vertical-product-container"]',
        (els) => els.length
      );
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);

      const loadMore = page.getByRole("button", { name: /visa fler/i });
      const visible = await loadMore.isVisible().catch(() => false);
      const disabled = visible
        ? await loadMore.isDisabled().catch(() => false)
        : true;
      if (!visible || disabled) break;

      await Promise.all([
        loadMore.click(),
        page
          .waitForFunction(
            (sel, prev) => document.querySelectorAll(sel).length > prev,
            { timeout: 15_000 },
            '[data-testid="vertical-product-container"]',
            beforeCount
          )
          .catch(() => null),
      ]);

      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(300);

      const afterCount = await page.$$eval(
        '[data-testid="vertical-product-container"]',
        (els) => els.length
      );
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
      price,
      compareOrdinaryPrice: p.compareOrdinaryPrice,
      priceMultipleItems: p.priceMultipleItems,
      productURL: abs(p.productURL),
      imageURL: abs(p.imageURL),
      store: "Hemköp",
    };
  });

  const uniqueProducts = Array.from(
    new Map(
      products.map((p) => [
        `${(p.name || "").toLowerCase()}|${p.volume || ""}`,
        p,
      ])
    ).values()
  );

  console.log(`Antal Hemköp produkter hittade: ${uniqueProducts.length}`);
  await page.close();
  await browser.close();
  return uniqueProducts;
}

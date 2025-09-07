import { launchBrowser } from "./_browser.js";
import { parsePriceSv } from "./utils/price.js";

// Huvudfunktion som hämtar veckans erbjudanden från Hemköp
export default async function scrapeHemkop() {
  // Startar en ny browser och öppnar en sida
  const browser = await launchBrowser();
  const page = await browser.newPage();

  // Sätter User-Agent och eventuella extra headers för att identifiera boten
  await page.setUserAgent(process.env.BOT_USER_AGENT || "SimpleScraper/1.0");
  if (process.env.BOT_FROM) {
    await page.setExtraHTTPHeaders({ From: process.env.BOT_FROM });
  }

  // Går till erbjudandesidan på hemkop.se
  await page.goto("https://www.hemkop.se/veckans-erbjudanden", {
    timeout: 90_000,
    waitUntil: "domcontentloaded",
  });

  // Klickar på "Visa fler" tills alla produkter är laddade
  const CARD_SEL = '[data-testid="vertical-product-container"]';
  while (true) {
    // Räknar antal produktkort innan klick
    const before = await page.$$eval(CARD_SEL, (els) => els.length);

    // Försöker hitta och klicka på "Visa fler"-knappen
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /visa fler/i.test(b.innerText || "")
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!clicked) break; // Om ingen knapp hittas, avsluta loopen

    // Väntar tills fler produkter har laddats in
    const grew = await page
      .waitForFunction(
        (sel, prev) => document.querySelectorAll(sel).length > prev,
        { timeout: 15_000 },
        CARD_SEL,
        before
      )
      .then(() => true)
      .catch(() => false);

    if (!grew) break; // Om inga fler produkter laddas, avsluta loopen
  }

  // Extraherar rådata för alla produktkort på sidan
  const rawProducts = await page.$$eval(CARD_SEL, (items) =>
    items.map((item) => {
      const q = (sel) => item.querySelector(sel);
      const qt = (sel) => q(sel)?.textContent?.trim() ?? null;

      return {
        name: qt('[data-testid="product-title"]'), // Produktnamn
        volume: qt('[data-testid="display-volume"]'), // Volym/mängd
        priceText: qt('[data-testid="price-text"]'), // Pristext
        compareOrdinaryPrice: qt('[data-testid="compare-price"]') || null, // Jämförpris
        priceMultipleItems:
          Array.from(item.querySelectorAll("*"))
            .map((el) => el.textContent?.trim() || "")
            .find((t) => /\d+\s*f[öo]r/i.test(t)) || null, // Ex: "2 för 30 kr"
        productURL: q("a")?.href || null, // Produktlänk
        imageURL: q("img")?.src || null, // Bildlänk
      };
    })
  );

  // Bearbetar produkterna: absolut länk, parsar pris, lägger till butik
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
      price: parsePriceSv(p.priceText), // Omvandlar pristext till siffra
      compareOrdinaryPrice: p.compareOrdinaryPrice,
      priceMultipleItems: p.priceMultipleItems,
      productURL: abs(p.productURL),
      imageURL: abs(p.imageURL),
      store: "Hemköp",
    };
  });

  // Tar bort dubbletter baserat på namn och volym
  const uniqueProducts = Array.from(
    new Map(
      products.map((p) => [
        `${(p.name || "").toLowerCase()}|${p.volume || ""}`,
        p,
      ])
    ).values()
  );

  // Stänger browsern och returnerar unika produkter
  await browser.close();
  return uniqueProducts;
}

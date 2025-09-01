import { chromium } from "playwright";

export default async function scrapeCityGross() {
  const browser = await chromium.launch({ headless: true });

  const uaBase = process.env.BOT_USER_AGENT || "SimpleScraper/1.0";
  const from = process.env.BOT_FROM || "you@example.com";
  const note =
    process.env.BOT_COMMENT ||
    "Hobbyprojekt för att lära mig och förstå kod bättre, för att sedan försöka landa ett jobb";

  const chromeUA =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  const context = await browser.newContext({
    userAgent: `${chromeUA} ${uaBase}`,
    extraHTTPHeaders: {
      ...(from ? { From: from } : {}),
      "X-Bot-Purpose": encodeURIComponent(note).slice(0, 200),
    },
    locale: "sv-SE",
  });

  const page = await context.newPage();

  const BASE_URL = "https://www.citygross.se/matvaror/veckans-erbjudande";
  const LAST_PAGE = 15;

  const products = [];

  for (let pageNum = 1; pageNum <= LAST_PAGE; pageNum++) {
    const url = pageNum === 1 ? BASE_URL : `${BASE_URL}?page=${pageNum}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    const appeared = await page
      .waitForSelector(".product-card-container", { timeout: 10000 })
      .catch(() => null);

    if (!appeared) {
      const hasCards = await page.$(".product-card-container");
      if (!hasCards) {
        console.log(
          `Sida ${pageNum}: inga .product-card-container (tom sida). Stoppar här.`
        );
        break;
      }
    }

    let previousCount = 0;
    let maxTries = 5;
    let tries = 0;

    while (tries < maxTries) {
      const currentCount = await page.$$eval(
        ".product-card-container",
        (els) => els.length
      );

      if (currentCount > previousCount) {
        previousCount = currentCount;
        tries = 0;
      } else {
        tries++;
      }

      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await page.waitForTimeout(1000);
    }

    const pageProducts = await page.$$eval(".product-card-container", (items) =>
      items.map((item) => {
        const name = item.querySelector("h3")?.innerText.trim() ?? null;
        const volume = item.querySelector("p")?.innerText.trim() ?? null;
        const productURL = item.querySelector("a")?.href ?? null;

        const priceBox = item.querySelector(".price-tag-container");
        let priceMultipleItems = null;
        let price = null;

        if (priceBox) {
          const multiEl = Array.from(priceBox.querySelectorAll("*")).find(
            (el) => /\d+\s*f[öo]r/i.test(el.textContent || "")
          );
          if (multiEl) {
            const m = (multiEl.textContent || "").match(/\d+\s*f[öo]r/i);
            priceMultipleItems = m ? m[0].trim() : null;
          }
          const majorEl = Array.from(
            priceBox.querySelectorAll("span,div,b,strong")
          ).find((el) => /^\d+$/.test((el.textContent || "").trim()));
          if (majorEl) price = (majorEl.textContent || "").trim();
        }

        let compareOrdinaryPrice =
          item
            .querySelector(".push-to-bottom")
            ?.innerText.replace(/[\n\r\t\\]/g, "")
            .replace(/(Jfr\s*pris)/i, "\n$1") ?? null;

        const img = item.querySelector("img");
        let imageURL = null;

        if (img) {
          const src = img.getAttribute("src");
          const srcset = img.getAttribute("srcset");

          if (src) {
            imageURL = src.startsWith("/")
              ? "https://www.citygross.se" + src
              : src;
          } else if (srcset) {
            const firstSrc = srcset.split(",")[0]?.trim().split(" ")[0];
            imageURL = firstSrc?.startsWith("/")
              ? "https://www.citygross.se" + firstSrc
              : firstSrc;
          }

          if (!imageURL) {
            console.log("Saknar imageURL för produkt:", name);
            console.log("IMG HTML:", img.outerHTML);
          }
        }

        return {
          name,
          price,
          store: "CityGross",
          volume,
          compareOrdinaryPrice,
          imageURL,
          priceMultipleItems,
          productURL,
        };
      })
    );

    console.log(`Sida ${pageNum}: hittade ${pageProducts.length} produkter`);
    products.push(...pageProducts);
  }

  const uniqueProducts = Array.from(
    new Map(products.map((p) => [`${p.name}|${p.volume}`, p])).values()
  );

  console.log("Antal CityGross produkter hittade:", uniqueProducts.length);
  await context.close();
  await browser.close();
  return uniqueProducts;
}

scrapeCityGross().catch((err) => {
  console.error("Fel under scraping:", err.message);
});

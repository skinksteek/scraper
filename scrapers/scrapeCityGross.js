// scrapers/scrapeCityGross.js
import { launchBrowser } from "./_browser.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scrapeCityGross() {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  const chromeUA =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  await page.setUserAgent(
    `${chromeUA} ${process.env.BOT_USER_AGENT || "SimpleScraper/1.0"}`
  );

  const headers = {};
  if (process.env.BOT_FROM) headers.From = process.env.BOT_FROM;
  if (process.env.BOT_COMMENT) {
    headers["X-Bot-Purpose"] = encodeURIComponent(
      process.env.BOT_COMMENT
    ).slice(0, 200);
  }
  if (Object.keys(headers).length) await page.setExtraHTTPHeaders(headers);

  const BASE_URL = "https://www.citygross.se/matvaror/veckans-erbjudande";
  const LAST_PAGE = 15;
  const products = [];

  for (let pageNum = 1; pageNum <= LAST_PAGE; pageNum++) {
    const url = pageNum === 1 ? BASE_URL : `${BASE_URL}?page=${pageNum}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const found = await page.$(".product-card-container");
    if (!found) break;

    // Scrolla för att ladda in fler produkter
    let prev = 0;
    for (let i = 0; i < 5; i++) {
      const count = await page.$$eval(
        ".product-card-container",
        (els) => els.length
      );
      if (count <= prev) break;
      prev = count;
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await sleep(1000); // ersätter page.waitForTimeout(1000)
    }

    const pageProducts = await page.$$eval(".product-card-container", (items) =>
      items.map((item) => {
        const name = item.querySelector("h3")?.innerText.trim() ?? null;
        const volume = item.querySelector("p")?.innerText.trim() ?? null;
        const productURL = item.querySelector("a")?.href ?? null;

        const priceBox = item.querySelector(".price-tag-container");
        let price = null;
        let priceMultipleItems = null;

        if (priceBox) {
          const multi = Array.from(priceBox.querySelectorAll("*")).find((el) =>
            /\d+\s*f[öo]r/i.test(el.textContent || "")
          );
          if (multi) {
            const m = (multi.textContent || "").match(/\d+\s*f[öo]r/i);
            priceMultipleItems = m ? m[0].trim() : null;
          }

          const major = Array.from(priceBox.querySelectorAll("span,div,strong"))
            .map((el) => (el.textContent || "").trim())
            .find((txt) => /^\d+$/.test(txt));
          if (major) price = major;
        }

        let imageURL = item.querySelector("img")?.getAttribute("src") || null;
        if (imageURL?.startsWith("/"))
          imageURL = "https://www.citygross.se" + imageURL;

        return {
          name,
          price,
          store: "CityGross",
          volume,
          compareOrdinaryPrice:
            item
              .querySelector(".push-to-bottom")
              ?.innerText.replace(/[\n\r\t\\]/g, "")
              ?.replace(/(Jfr\s*pris)/i, "\n$1") ?? null,
          imageURL,
          priceMultipleItems,
          productURL,
        };
      })
    );

    products.push(...pageProducts);
  }

  const uniqueProducts = Array.from(
    new Map(products.map((p) => [`${p.name}|${p.volume}`, p])).values()
  );

  await browser.close();
  return uniqueProducts;
}

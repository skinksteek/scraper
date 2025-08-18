import { chromium } from "playwright";
import "dotenv/config";

export default async function scrapeCityGross() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://www.citygross.se/matvaror/veckans-erbjudande", {
    waitUntil: "domcontentloaded",
  });

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

  const products = await page.$$eval(".product-card-container", (items) =>
    items.map((item) => {
      const name = item.querySelector("h3")?.innerText.trim() ?? null;
      const volume = item.querySelector("p")?.innerText.trim() ?? null;

      let price = item.querySelector("div.sc-islFiG")?.innerText.trim() ?? null;
      if (price) {
        const match = price.match(/.*pris.*$/i);
        price = match ? match[0].trim() : price.trim();
        price = price.replace(/^pris\s*/i, "");
      }

      let priceMultipleItems =
        item.querySelector("div.sc-kSGOQU")?.innerText.trim() ?? null;
      if (priceMultipleItems) {
        priceMultipleItems = priceMultipleItems.replace(/^kampanj\s*/i, "");
        priceMultipleItems = priceMultipleItems.replace(/^klipp!\s*/i, "");
        priceMultipleItems = priceMultipleItems.replace(/^PRIO-pris\s*/i, "");
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
      };
    })
  );

  console.log("Antal CityGross produkter hittade:", products.length);
  await browser.close();
  return products;
}

scrapeCityGross().catch((err) => {
  console.error("Fel under scraping:", err.message);
});

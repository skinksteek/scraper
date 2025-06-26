import { chromium } from "playwright";
import { supabase } from "./lib/supabaseClient.js";
import "dotenv/config";

async function scrapeCityGross() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.citygross.se/matvaror/veckans-erbjudande", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector(".product-card-container");

  const products = await page.$$eval(".product-card-container", (items) =>
    items.map((item) => {
      const name = item.querySelector("h3")?.innerText.trim() ?? null;
      const volume = item.querySelector("p")?.innerText.trim() ?? null;
      const price = item.querySelector(".sc-eVZGIO")?.innerText.trim() ?? null;

      let getMorePrice =
        item.querySelector(".sc-cLNonn")?.innerText.trim() ?? null;

      // Vissa produkter har nått av orden nedan bredvid sitt pris och detta vill vi inte ha
      const blacklist = ["kampanj", "prio-pris", "klipp!"];
      if (
        getMorePrice &&
        blacklist.some((word) =>
          getMorePrice.toLowerCase().includes(word.toLowerCase())
        )
      ) {
        getMorePrice = null;
      }

      const compareOrdinaryPrice =
        item
          .querySelector(".push-to-bottom")
          ?.innerText.replace(/[\n\r\t\\]/g, "") ?? null;

      return {
        name,
        price,
        store: "CityGross",
        volume,
        getMorePrice,
        compareOrdinaryPrice,
      };
    })
  );

  const { error } = await supabase.from("products").insert(products);
  if (error) {
    console.error("Fel vid insättning:", error.message);
  } else {
    console.log("Produkter insatta");
  }

  await browser.close();
}

scrapeCityGross().catch(console.error);

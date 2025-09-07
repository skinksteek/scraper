import { launchBrowser } from "./_browser.js";

// Enkel sleep-funktion som pausar i angivet antal millisekunder
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Försöker gå till en sida, med retry/backoff om det misslyckas
async function gotoWithRetry(page, url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const resp = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      if (!resp || !resp.ok()) throw new Error(`HTTP ${resp?.status()}`);
      return;
    } catch {
      if (i === tries) throw new Error(`goto failed: ${url}`);
      await sleep(800 * i); // Vänta längre för varje försök
    }
  }
}

// Försöker klicka på en samtyckesknapp (cookies etc) om den finns
async function tryAcceptConsent(page) {
  try {
    await page.evaluate(() => {
      const btn = Array.from(
        document.querySelectorAll('button,[role="button"],.btn')
      ).find((b) =>
        /acceptera|godkänn|tillåt|ok|jag förstår/i.test(
          (b.textContent || "").toLowerCase()
        )
      );
      if (btn) btn.click();
    });
  } catch {}
}

// Huvudfunktion som hämtar veckans erbjudanden från CityGross
export default async function scrapeCityGross() {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  // Sätter User-Agent och eventuella extra headers för att identifiera boten
  const chromeUA =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  await page.setUserAgent(
    `${chromeUA} ${process.env.BOT_USER_AGENT || "SimpleScraper/1.0"}`
  );
  const headers = {
    "Accept-Language": "sv-SE,sv;q=0.9",
  };
  if (process.env.BOT_FROM) headers.From = process.env.BOT_FROM;
  if (process.env.BOT_COMMENT) {
    headers["X-Bot-Purpose"] = encodeURIComponent(
      process.env.BOT_COMMENT
    ).slice(0, 200);
  }
  await page.setExtraHTTPHeaders(headers);

  const BASE_URL = "https://www.citygross.se/matvaror/veckans-erbjudande";
  const products = [];

  // Loopa igenom alla sidor med erbjudanden
  for (let pageNum = 1; ; pageNum++) {
    const url = pageNum === 1 ? BASE_URL : `${BASE_URL}?page=${pageNum}`;
    await gotoWithRetry(page, url);
    await tryAcceptConsent(page);

    // Vänta tills minst några produktkort finns
    await page
      .waitForFunction(
        () => document.querySelectorAll(".product-card-container").length >= 6,
        { timeout: 15_000 }
      )
      .catch(() => {});

    // Om inga produktkort hittas, avsluta loopen
    const hasCards = await page.$(".product-card-container");
    if (!hasCards) break;

    // Scrolla ner på sidan för att ladda in fler produkter
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await sleep(600 + Math.random() * 600);
    }

    // Extrahera produktdata från sidan
    const pageProducts = await page.$$eval(".product-card-container", (items) =>
      items.map((item) => {
        // Hjälpare för detta kort
        const q = (sel) => item.querySelector(sel); // q = query
        const qa = (sel) => Array.from(item.querySelectorAll(sel)); // qa = query all
        const qt = (sel) => q(sel)?.textContent?.trim() ?? null; // qt = query text
        const abs = (href) => {
          // abs = absolutize URL
          try {
            return href ? new URL(href, "https://www.citygross.se").href : null;
          } catch {
            return href || null;
          }
        };

        const name = qt("h3");
        const volume = qt("p");
        const productURL = abs(q("a")?.getAttribute("href"));

        // Prisruta
        const priceBox = q(".price-tag-container");

        // “2 för 30 kr”-text (om det finns)
        const priceMultipleItems = priceBox
          ? qa(".price-tag-container *")
              .map((el) => el.textContent?.trim() || "")
              .find((t) => /\d+\s*f[öo]r/i.test(t)) || null
          : null;

        // Huvudpris (t.ex. "30")
        const price = priceBox
          ? qa(
              ".price-tag-container span, .price-tag-container div, .price-tag-container strong"
            )
              .map((el) => (el.textContent || "").trim())
              .find((txt) => /^\d+$/.test(txt)) || null
          : null;

        // Bild (srcset eller src) → absolut URL
        const imgAttr =
          q("img")?.getAttribute("srcset") ||
          q("img")?.getAttribute("src") ||
          null;
        const imageURL = abs(imgAttr);

        // Jämförpris (städad)
        const compareOrdinaryPrice =
          q(".push-to-bottom")
            ?.innerText?.replace(/[\n\r\t\\]/g, "")
            ?.replace(/(Jfr\s*pris)/i, "\n$1") ?? null;

        return {
          name,
          volume,
          price, // sträng, ex "30"
          compareOrdinaryPrice,
          priceMultipleItems, // ex "2 för 30 kr"
          productURL,
          imageURL,
          store: "CityGross",
        };
      })
    );

    products.push(...pageProducts);

    // Om denna sida gav få produkter, avsluta loopen
    if (pageProducts.length < 5) break;

    // Liten slumpmässig paus mellan sidladdningar
    await sleep(400 + Math.random() * 800);
  }

  // Ta bort dubbletter baserat på namn och volym
  const uniqueProducts = Array.from(
    new Map(products.map((p) => [`${p.name}|${p.volume}`, p])).values()
  );

  await browser.close();
  return uniqueProducts;
}

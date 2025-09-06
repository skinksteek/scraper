import { supabase } from "../lib/supabaseClient.js";
import scrapeHemkop from "../scrapers/scrapeHemkop.js";
import scrapeCityGross from "../scrapers/scrapeCityGross.js";

export async function runScrapeAll() {
  process.env.BOT_USER_AGENT ||= "SimpleScraper/1.0";
  process.env.BOT_FROM ||= "linusigelstrom@gmail.com";
  process.env.BOT_COMMENT ||=
    "Hobbyprojekt för att lära mig och förstå kod bättre, för att sedan försöka landa ett jobb";

  // 1) Rensa tabellen
  const { error: resetErr } = await supabase.rpc("reset_products");
  if (resetErr)
    throw new Error(`Kunde inte tömma tabellen: ${resetErr.message}`);
  console.log("Befintliga produkter rensade..");

  // 2) Scrapa parallellt (snabbare, bättre chans att hålla dig inom timeout)
  const [hemkopProducts, cityGrossProducts] = await Promise.all([
    scrapeHemkop(),
    scrapeCityGross(),
  ]);

  // 3) Skriv in
  const allProducts = [...hemkopProducts, ...cityGrossProducts];
  const { error: insertErr } = await supabase
    .from("products")
    .insert(allProducts);
  if (insertErr) throw new Error(`Fel vid insättning: ${insertErr.message}`);

  console.log(
    `Insättning lyckades - totalt ${allProducts.length} produkter insatta.`
  );
  return allProducts.length;
}

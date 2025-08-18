import { supabase } from "../lib/supabaseClient.js";
import scrapeHemkop from "../scrapers/scrapeHemkop.js";
import scrapeCityGross from "../scrapers/scrapeCityGross.js";

async function main() {
  const { error } = await supabase.rpc("reset_products");
  if (error) {
    console.error("Kunde inte tömma tabellen:", error.message);
    return;
  }
  console.log("Befintliga produkter rensade..");

  const hemkopProducts = await scrapeHemkop();
  const cityGrossProducts = await scrapeCityGross();

  const allProducts = [...hemkopProducts, ...cityGrossProducts];
  const { error: insertError } = await supabase
    .from("products")
    .insert(allProducts);
  if (insertError) {
    console.error("Fel vid insättning:", insertError.message);
  } else {
    console.log(
      `Insättning lyckades - totalt ${allProducts.length} produkter insatta.`
    );
  }
}

main().catch((err) => {
  console.error("Något gick fel i main():", err.message);
});

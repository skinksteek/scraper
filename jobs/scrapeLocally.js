import { runScrapeAll } from "./scrapeAll.js";

runScrapeAll().catch((err) => {
  console.error("Något gick fel:", err);
  process.exit(1);
});

import { runScrapeAll } from "../jobs/scrapeAll.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    const count = await runScrapeAll();
    res.status(200).json({ ok: true, count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * Scraping Service — Manages scraping sessions and URL-targeted scraping.
 */

import { runScrapingSession } from '../engine/session.js';
import { aggregate } from '../engine/aggregator.js';
import { RETAILER_SCRAPERS } from '../engine/config/retailers.config.js';
import { ScrapingRepository } from '../repositories/scrapingRepository.js';
import { AppError } from '../../../core/errors/errors.js';

export class ScrapingService {
  private repo = new ScrapingRepository();
  private static fullSessionRunning = false;
  private static runningJobs = new Set<number>();

  static resetLocks() {
    this.fullSessionRunning = false;
    this.runningJobs.clear();
  }

  static isRunning() {
    return this.fullSessionRunning || this.runningJobs.size > 0;
  }

  static getStatus() {
    return {
      running: this.isRunning(),
      full_session_running: this.fullSessionRunning,
      running_jobs: [...this.runningJobs],
    };
  }

  async runFullSession() {
    if (ScrapingService.fullSessionRunning) {
      throw new AppError('CONFLICT', 'A full scraping session is already running', 409);
    }

    ScrapingService.fullSessionRunning = true;
    (async () => {
      try {
        await runScrapingSession();
      } finally {
        ScrapingService.fullSessionRunning = false;
      }
    })();
  }

  async runRetailerSession(retailerId: number) {
    const retailer = await this.repo.getRetailerById(retailerId);
    if (!retailer) {
      throw new AppError('NOT_FOUND', `Retailer ${retailerId} not found`, 404);
    }

    if (ScrapingService.runningJobs.has(retailerId)) {
      throw new AppError('CONFLICT', `A scraping job is already running for retailer ${retailerId}`, 409);
    }

    ScrapingService.runningJobs.add(retailerId);
    (async () => {
      try {
        await runScrapingSession(retailerId);
      } finally {
        ScrapingService.runningJobs.delete(retailerId);
      }
    })();
  }

  async scrapeUrls(urls: { retailer_id: number; product_url: string }[]) {
    const byRetailer = new Map<number, string[]>();
    for (const entry of urls) {
      if (!byRetailer.has(entry.retailer_id)) byRetailer.set(entry.retailer_id, []);
      byRetailer.get(entry.retailer_id)!.push(entry.product_url);
    }

    const allPrices = [];
    let scraped = 0;
    let failed = 0;

    for (const [retailerId, targetUrls] of byRetailer) {
      const retailer = (await this.repo.getRetailerById(retailerId)) as { id: number; name: string; base_url: string } | undefined;
      if (!retailer) {
        failed += targetUrls.length;
        continue;
      }

      const config = RETAILER_SCRAPERS.find((s) => s.baseUrl === retailer.base_url);
      if (!config) {
        failed += targetUrls.length;
        continue;
      }

      try {
        const prices = await config.run(retailerId);
        const targetSet = new Set(targetUrls);
        const filtered = prices.filter((p) => targetSet.has(p.product_url));
        allPrices.push(...filtered);
        scraped += filtered.length;
        failed += targetUrls.length - filtered.length;
      } catch {
        failed += targetUrls.length;
      }
    }

    if (allPrices.length > 0) {
      await aggregate(allPrices);
    }

    return { scraped, failed };
  }
}

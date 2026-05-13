/**
 * Scraping Repository — Handles database access for scraping-related entities.
 */

import { getSql } from '../../../core/db/index.js';

export class ScrapingRepository {
  async getActiveRetailers() {
    return getSql()`
      SELECT id, name, base_url, scraping_enabled
      FROM retailers
      WHERE is_active = true
    `;
  }

  async getRetailerById(id: number) {
    const rows = await getSql()`
      SELECT id, name, base_url, scraping_enabled
      FROM retailers
      WHERE id = ${id} AND is_active = true
    `;
    return rows[0];
  }
}

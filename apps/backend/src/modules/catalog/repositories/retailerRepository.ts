import { getSql } from '../../../core/db/index.js';

export interface Retailer {
  id: number;
  name: string;
  base_url: string;
  logo_url?: string;
  country: string;
  is_active: boolean;
  scraping_enabled: boolean;
  scraping_interval_hours: number;
  last_scrape_at?: string;
  last_scrape_status?: string;
  notes?: string;
}

export interface RetailerWithStats extends Retailer {
  price_records_count: number;
}

export class RetailerRepository {
  private sql = getSql();

  async findAll(includeInactive = false): Promise<RetailerWithStats[]> {
    return this.sql`
      SELECT
        r.*,
        COUNT(p.id) AS price_records_count
      FROM retailers r
      LEFT JOIN prices p ON p.retailer_id = r.id
      WHERE (${includeInactive ? null : true}::boolean IS NULL OR r.is_active = true)
      GROUP BY r.id
      ORDER BY r.name ASC
    ` as Promise<RetailerWithStats[]>;
  }

  async findById(id: number): Promise<RetailerWithStats | null> {
    const rows = (await this.sql`
      SELECT
        r.*,
        COUNT(p.id) AS price_records_count
      FROM retailers r
      LEFT JOIN prices p ON p.retailer_id = r.id
      WHERE r.id = ${id}
      GROUP BY r.id
      LIMIT 1
    `) as RetailerWithStats[];

    return rows[0] || null;
  }

  async insert(data: any): Promise<Retailer> {
    const rows = (await this.sql`
      INSERT INTO retailers (name, base_url, logo_url, country, is_active, scraping_interval_hours, notes)
      VALUES (
        ${data.name},
        ${data.base_url},
        ${data.logo_url ?? null},
        ${data.country ?? 'MA'},
        true,
        ${data.scraping_interval_hours ?? 24},
        ${data.notes ?? null}
      )
      RETURNING *
    `) as Retailer[];

    return rows[0];
  }

  async update(id: number, data: any): Promise<Retailer | null> {
    const rows = (await this.sql`
      UPDATE retailers SET
        name                    = COALESCE(${data.name ?? null}, name),
        base_url                = COALESCE(${data.base_url ?? null}, base_url),
        logo_url                = COALESCE(${data.logo_url ?? null}, logo_url),
        country                 = COALESCE(${data.country ?? null}, country),
        is_active               = COALESCE(${data.is_active ?? null}, is_active),
        scraping_enabled        = COALESCE(${data.scraping_enabled ?? null}, scraping_enabled),
        scraping_interval_hours = COALESCE(${data.scraping_interval_hours ?? null}, scraping_interval_hours),
        notes                   = COALESCE(${data.notes ?? null}, notes)
      WHERE id = ${id}
      RETURNING *
    `) as Retailer[];

    return rows[0] || null;
  }

  async updateScrapeStatus(id: number, status: string): Promise<void> {
    await this.sql`
      UPDATE retailers
      SET last_scrape_at = NOW(), last_scrape_status = ${status}
      WHERE id = ${id}
    `;
  }
}

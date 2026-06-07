import { getSql } from '../../../../core/db/index.js';
import { sql as bunSql } from 'bun';

export interface UnmatchedListingFilter {
  search?: string;
  retailerId?: number | null;
  category?: string;
}

export class UnmatchedRepository {
  private get sql() {
    return getSql();
  }

  async getPendingListingsWithSuggestions(filters: UnmatchedListingFilter) {
    const { search, retailerId, category } = filters;

    return (await this.sql`
      SELECT
        ul.id,
        ul.retailer_id,
        r.name                        AS retailer_name,
        ul.scraped_name,
        ul.scraped_price,
        ul.product_url,
        ul.image_url,
        ul.image_urls,
        ul.scraped_at,
        COALESCE(us.canonical_name, ul.scraped_name) AS canonical_name,
        us.brand,
        us.category,
        COALESCE(us.confidence, 'unknown')           AS confidence,
        us.existing_component_id,
        us.specs_hint,
        ec.name                       AS existing_component_name,
        ec.brand                      AS existing_component_brand
      FROM unmatched_listings ul
      JOIN retailers r ON r.id = ul.retailer_id
      LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
      LEFT JOIN components ec ON ec.id = us.existing_component_id
      WHERE ul.status = 'pending'
        AND (${retailerId ?? null}::int IS NULL OR ul.retailer_id = ${retailerId ?? null})
        AND (
          ${category ?? ''}::text = ''
          OR (${category ?? ''} = 'none' AND us.category IS NULL)
          OR us.category = ${category ?? ''}
        )
        AND (
          ${search ?? ''}::text = ''
          OR ul.scraped_name ILIKE '%' || ${search ?? ''} || '%'
          OR COALESCE(us.canonical_name, ul.scraped_name) ILIKE '%' || ${search ?? ''} || '%'
        )
      ORDER BY ul.scraped_at DESC
    `) as any[];
  }

  async bulkDismiss(listingIds: number[]) {
    if (listingIds.length === 0) return 0;

    const updated = (await this.sql`
      UPDATE unmatched_listings
      SET status = 'dismissed'
      WHERE id IN ${bunSql(listingIds)} AND status = 'pending'
      RETURNING id
    `) as { id: number }[];

    if (updated.length > 0) {
      const dismissedIds = updated.map((r) => r.id);
      await this.sql`
        DELETE FROM unmatched_suggestions
        WHERE unmatched_listing_id IN ${bunSql(dismissedIds)}
      `;
    }

    return updated.length;
  }

  async getHighConfidenceLinks(canonicalNames: string[]) {
    return (await this.sql`
      SELECT
        us.canonical_name,
        us.existing_component_id,
        ul.id          AS listing_id,
        ul.retailer_id,
        ul.product_url,
        ul.scraped_name
      FROM unmatched_suggestions us
      JOIN unmatched_listings ul ON ul.id = us.unmatched_listing_id
      WHERE us.confidence = 'high'
        AND us.existing_component_id IS NOT NULL
        AND ul.status = 'pending'
        AND us.canonical_name IN ${bunSql(canonicalNames)}
    `) as any[];
  }

  async linkListingsToComponent(tx: any, listingIds: number[], componentId: number) {
    // This expects listing objects but we can fetch them or pass them
    // For simplicity, let's fetch them in the service or here
    const listings = (await tx`
      SELECT id, retailer_id, product_url, scraped_name
      FROM unmatched_listings
      WHERE id IN ${bunSql(listingIds)}
    `) as any[];

    for (const listing of listings) {
      await tx`
        INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
        VALUES (${componentId}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_name})
        ON CONFLICT (retailer_id, product_url) DO UPDATE SET
          component_id = EXCLUDED.component_id,
          updated_at   = NOW()
      `;
      await tx`
        UPDATE unmatched_listings
        SET status = 'linked', linked_component_id = ${componentId}
        WHERE id = ${listing.id}
      `;
      await tx`DELETE FROM unmatched_suggestions WHERE unmatched_listing_id = ${listing.id}`;
    }
    return listings.length;
  }

  async findDuplicateComponent(name: string, category: string, brand: string | null) {
    return (await this.sql`
      SELECT id, name, brand, slug FROM components
      WHERE LOWER(name) = LOWER(${name})
        AND category = ${category}
        AND (
          ${brand}::text IS NULL AND brand IS NULL
          OR LOWER(brand) = LOWER(${brand ?? ''})
        )
      LIMIT 1
    `) as any[];
  }

  async getListings(params: {
    status?: string;
    retailerId?: number;
    search?: string;
    category?: string;
    limit: number;
    offset: number;
  }) {
    const { status, retailerId, search, category, limit, offset } = params;

    const rows = await this.sql`
      SELECT
        ul.*,
        r.name AS retailer_name,
        us.category AS suggested_category,
        COUNT(*) OVER() AS total_count
      FROM unmatched_listings ul
      JOIN retailers r ON r.id = ul.retailer_id
      LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
      WHERE (${status ?? null}::text IS NULL OR ul.status = ${status ?? null})
        AND (${retailerId ?? null}::int IS NULL OR ul.retailer_id = ${retailerId ?? null})
        AND (
          ${category ?? ''}::text = '' 
          OR (${category} = 'none' AND us.category IS NULL)
          OR us.category = ${category}
        )
        AND (${search ?? null}::text IS NULL OR (
          SELECT bool_and(ul.scraped_name ILIKE '%' || word || '%')
          FROM unnest(string_to_array(trim(regexp_replace(${search ?? ''}, '\\s+', ' ', 'g')), ' ')) AS word
        ))
      ORDER BY ul.scraped_at DESC
      LIMIT ${limit} OFFSET ${offset}
    ` as (Record<string, unknown> & { total_count: string })[];

    const total = rows.length > 0 ? parseInt(rows[0].total_count as string, 10) : 0;
    const listings = rows.map(({ total_count: _tc, ...row }) => row);

    return { listings, total };
  }

  async getListingById(id: number) {
    const rows = await this.sql`
      SELECT * FROM unmatched_listings WHERE id = ${id} LIMIT 1
    ` as any[];
    return rows[0] || null;
  }

  async getListingsByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return (await this.sql`
      SELECT * FROM unmatched_listings WHERE id IN ${bunSql(ids)}
    `) as any[];
  }

  async updateManualCategory(id: number, category: string | null) {
    const rows = await this.sql`
      UPDATE unmatched_listings 
      SET manual_category = ${category ?? null} 
      WHERE id = ${id} 
      RETURNING id
    ` as { id: number }[];
    return rows.length > 0;
  }

  async bulkUpdateManualCategory(ids: number[], category: string | null) {
    if (ids.length === 0) return 0;
    const rows = await this.sql`
      UPDATE unmatched_listings 
      SET manual_category = ${category ?? null} 
      WHERE id IN ${bunSql(ids)} 
      RETURNING id
    ` as { id: number }[];
    return rows.length;
  }

  async getPendingWithCategory() {
    return (await this.sql`
      SELECT
        ul.id          AS listing_id,
        ul.retailer_id,
        ul.product_url,
        ul.scraped_name,
        ul.scraped_price,
        ul.image_url,
        ul.image_urls,
        COALESCE(us.canonical_name, ul.scraped_name) AS canonical_name,
        us.brand,
        us.category,
        COALESCE(us.confidence, 'unknown')           AS confidence,
        us.existing_component_id,
        us.specs_hint
      FROM unmatched_listings ul
      JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
      WHERE ul.status = 'pending'
        AND us.category IS NOT NULL
        AND us.category != 'standby'
        AND us.confidence = 'high'
      ORDER BY ul.scraped_at DESC
    `) as any[];
  }

  async getCategorySummary() {
    return (await this.sql`
      SELECT
        us.category,
        COUNT(DISTINCT COALESCE(us.canonical_name, ul.scraped_name))::int AS group_count,
        COUNT(DISTINCT CASE
          WHEN us.confidence = 'high' AND us.existing_component_id IS NOT NULL
          THEN COALESCE(us.canonical_name, ul.scraped_name)
        END)::int AS high_confidence_linkable_count
      FROM unmatched_listings ul
      LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
      WHERE ul.status = 'pending'
      GROUP BY us.category
      ORDER BY us.category ASC NULLS LAST
    `) as {
      category: string | null;
      group_count: number;
      high_confidence_linkable_count: number;
    }[];
  }

  async linkListingToComponent(id: number, componentId: number) {
    const listing = await this.getListingById(id);
    if (!listing) return null;

    return await this.sql.begin(async (tx) => {
      // Create scraper mapping
      const mappings = await tx`
        INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
        VALUES (${componentId}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_name})
        ON CONFLICT (retailer_id, product_url) DO UPDATE SET component_id = ${componentId}, updated_at = NOW()
        RETURNING id
      ` as { id: number }[];

      // Update listing status
      await tx`
        UPDATE unmatched_listings
        SET status = 'linked', linked_component_id = ${componentId}
        WHERE id = ${id}
      `;

      return mappings[0].id;
    });
  }
}

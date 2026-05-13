import { getSql } from '../../../../core/db/index.js';
import { KeywordRule } from '../../services/keywordRulesService.js';

export class KeywordRuleRepository {
  private sql = getSql();

  async getAllRulesWithMatchCount() {
    return (await this.sql`
      SELECT
        kr.id,
        kr.keyword,
        kr.match_type,
        kr.category,
        kr.source,
        kr.created_by,
        kr.created_at,
        (
          SELECT COUNT(*)::int
          FROM unmatched_listings ul
          WHERE ul.status = 'pending'
            AND ul.scraped_name ILIKE '%' || kr.keyword || '%'
        ) AS match_count
      FROM keyword_rules kr
      ORDER BY kr.source ASC, kr.created_at DESC
    `) as (KeywordRule & { match_count: number })[];
  }

  async getPendingListingNames() {
    return (await this.sql`
      SELECT id, scraped_name FROM unmatched_listings WHERE status = 'pending'
    `) as { id: number; scraped_name: string }[];
  }

  async insertRule(data: { keyword: string; match_type: string; category: string; source: string; created_by: number | null }) {
    const rows = (await this.sql`
      INSERT INTO keyword_rules (keyword, match_type, category, source, created_by)
      VALUES (${data.keyword}, ${data.match_type}, ${data.category}, ${data.source}, ${data.created_by})
      RETURNING id, keyword, match_type, category, source, created_by, created_at
    `) as KeywordRule[];
    return rows[0];
  }

  async getRuleById(id: number) {
    const rows = (await this.sql`
      SELECT id, keyword, match_type, category, source FROM keyword_rules WHERE id = ${id} LIMIT 1
    `) as { id: number; keyword: string; match_type: string; category: string; source: string }[];
    return rows[0] || null;
  }

  async deleteRule(id: number) {
    await this.sql`DELETE FROM keyword_rules WHERE id = ${id}`;
  }
}

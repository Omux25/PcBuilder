import { Context } from 'hono';
import { KeywordRuleService } from '../services/keywordRuleService.js';
import { logActivity } from '../../../admin/services/adminService.js';
import { parseId } from '../../../../core/errors/errors.js';

const VALID_CATEGORIES = new Set([
  'cpu', 'gpu', 'ram', 'motherboard', 'storage',
  'psu', 'case', 'cooling', 'fan', 'thermal_paste',
]);

const VALID_MATCH_TYPES = new Set(['contains', 'word', 'starts_with', 'number_before']);

export class KeywordRuleController {
  private service = new KeywordRuleService();

  async getRules(c: Context) {
    const rules = await this.service.getAllRules();
    return c.json(rules);
  }

  async preview(c: Context) {
    const body = await c.req.json();
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    const match_type = body.match_type as string;

    if (!keyword || keyword.length > 200) {
      return c.json({ error: { code: 'INVALID_KEYWORD', message: 'keyword must be 1\u2013200 characters' } }, 400);
    }
    if (!VALID_MATCH_TYPES.has(match_type)) {
      return c.json({ error: { code: 'INVALID_MATCH_TYPE', message: 'Invalid match type' } }, 400);
    }

    const result = await this.service.previewRule(keyword, match_type);
    return c.json(result);
  }

  async createRule(c: Context) {
    const admin = c.get('admin') as { id: number } | undefined;
    const body = await c.req.json();

    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    const match_type = body.match_type as string;
    const category = body.category as string;

    if (!keyword || !VALID_MATCH_TYPES.has(match_type) || !VALID_CATEGORIES.has(category)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } }, 400);
    }

    const rule = await this.service.createRule({
      keyword,
      match_type,
      category,
      created_by: admin?.id ?? null
    });

    if (admin?.id) {
      await logActivity(admin.id, 'keyword_rule_created', 'keyword_rules', rule.id, { keyword, match_type, category });
    }

    return c.json(rule, 201);
  }

  async deleteRule(c: Context) {
    const id = parseId(c.req.param('id'));
    if (id === null) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);
    }
    const admin = c.get('admin') as { id: number } | undefined;

    await this.service.deleteRule(id);

    if (admin?.id) {
      await logActivity(admin.id, 'keyword_rule_deleted', 'keyword_rules', id);
    }

    return c.json({ success: true });
  }
}

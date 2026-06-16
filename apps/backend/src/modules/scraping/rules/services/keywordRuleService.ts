import { KeywordRuleRepository } from '../repositories/keywordRuleRepository.js';
import { matchesRule, clearRegexCache } from '../../services/keywordRulesService.js';
import { AppError } from '../../../../core/errors/errors.js';

export class KeywordRuleService {
  private repository = new KeywordRuleRepository();

  async getAllRules() {
    return this.repository.getAllRulesWithMatchCount();
  }

  async previewRule(keyword: string, matchType: string) {
    const pending = await this.repository.getPendingListingNames();
    const rule = { keyword, match_type: matchType as any };
    const matching = pending.filter(l => matchesRule(rule, l.scraped_name));

    return {
      match_count: matching.length,
      sample_names: matching.slice(0, 20).map(l => l.scraped_name),
    };
  }

  async createRule(data: { keyword: string; match_type: string; category: string; created_by: number | null }) {
    try {
      const rule = await this.repository.insertRule({
        ...data,
        source: 'admin'
      });

      clearRegexCache();
      this.runAutoProcessing();

      return rule;
    } catch (err: any) {
      const msg = err.message;
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        throw new AppError('DUPLICATE_RULE', `A rule for keyword "${data.keyword}" already exists`, 409);
      }
      throw err;
    }
  }

  async deleteRule(id: number) {
    const rule = await this.repository.getRuleById(id);
    if (!rule) {
      throw new AppError('NOT_FOUND', `Keyword rule ${id} not found`, 404);
    }

    if (rule.source === 'builtin') {
      throw new AppError('CANNOT_DELETE_BUILTIN', 'Built-in rules cannot be deleted', 403);
    }

    await this.repository.deleteRule(id);
    clearRegexCache();
    this.runAutoProcessing();
  }

  private runAutoProcessing() {
    // The Zero-Touch pipeline runs as a scheduled job, so we don't need to trigger deep processing here anymore.
    // If you wanted to re-run category classification instantly, you could trigger a lightweight worker here.
  }
}

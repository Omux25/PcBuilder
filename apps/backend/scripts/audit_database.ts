import { sql } from 'bun';
import fs from 'fs';
import { inferCategory } from '@shared/component-utils';

async function runAudit() {
  console.log("--- Starting Comprehensive Database Integrity Audit ---");

  // 1. Identify "Complete Builds"
  const buildRegex = /(pc gamer|gamer pc|pc build|desktop pc|gaming pc|built pc|pre-built|prebuilt|gaming desktop|workstation pc|computer system)/i;
  
  // 2. Identify "Cases"
  const caseRegex = /(chassis|tower|cabinet|atx case|itx case|matx case|mid-tower|full-tower)/i;

  console.log("Auditing components table...");
  const components = await sql`SELECT id, name, category, brand FROM components WHERE is_active = true` as any[];
  
  const problematicComponents = [];

  for (const c of components) {
    const name = c.name;
    // Improved Bundle/Build detection for catalog (CPU + GPU signal)
    const cpuSignals = [/\bryzen/i, /\bcore\s+i/i, /\bcore\s+ultra/i, /\bthreadripper/i, /\bxeon\b/i, /\bi[3579]-\d/i];
    const gpuSignals = [/\brtx/i, /\bgtx/i, /\bradeon/i, /\brx\s*\d/i, /\bquadro\b/i, /\bfirepro\b/i, /\bpro\s*(6|5)000\b/i];

    const hasCpu = cpuSignals.some(r => r.test(name));
    const hasGpu = gpuSignals.some(r => r.test(name));
    
    if ((hasCpu && hasGpu) || buildRegex.test(name)) {
      problematicComponents.push({
        id: c.id,
        name: c.name,
        category: c.category,
        issue: (hasCpu && hasGpu) ? 'Suspected Bundle/Workstation' : 'Suspected Complete Build'
      });
      continue;
    }

    // Check for cases in wrong category
    const looksLikeCase = caseRegex.test(name) || (name.toLowerCase().includes('case') && !name.toLowerCase().includes('fan') && !name.toLowerCase().includes('screw') && !name.toLowerCase().includes('accessory') && !name.toLowerCase().includes('cooling'));
    if (looksLikeCase && c.category !== 'case') {
      problematicComponents.push({
        id: c.id,
        name: c.name,
        category: c.category,
        issue: 'Misclassified Case'
      });
    }

    // Check for Fans misclassified as wireless adapters (common pattern observed)
    if (name.toLowerCase().includes('fan') && c.category === 'wireless_network_adapter') {
       problematicComponents.push({
        id: c.id,
        name: c.name,
        category: c.category,
        issue: 'Fan misclassified as Wireless Adapter'
      });
    }
  }

  console.log("Checking keyword_rules for 'wireless'...");
  const rules = await sql`
    SELECT * FROM keyword_rules WHERE keyword ILIKE '%wireless%'
  ` as any[];
  
  console.log("Rules:");
  rules.forEach(r => console.log(` - [${r.category}] ${r.keyword} (${r.match_type})`));

  console.log("Auditing unmatched_listings table using shared logic...");
  const unmatched = await sql`
    SELECT ul.id, ul.scraped_name, ul.product_url, us.category as current_suggestion
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
  ` as any[];

  const problematicUnmatched = [];

  for (const u of unmatched) {
    const name = u.scraped_name;
    const currentCat = u.current_suggestion || 'none';
    const newInferred = inferCategory(name);

    // 1. Check for builds
    if (newInferred === 'build') {
      problematicUnmatched.push({
        id: u.id,
        name: u.scraped_name,
        current_suggestion: currentCat,
        issue: 'Suspected Complete Build'
      });
      continue;
    }

    // 2. Check for category mismatches (new logic vs current DB suggestion)
    if (newInferred && newInferred !== currentCat && currentCat !== 'none') {
       problematicUnmatched.push({
        id: u.id,
        name: u.scraped_name,
        current_suggestion: currentCat,
        new_suggestion: newInferred,
        issue: `Category Mismatch (${currentCat} -> ${newInferred})`
      });
    }
  }

  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      totalComponents: components.length,
      problematicComponents: problematicComponents.length,
      totalUnmatchedPending: unmatched.length,
      problematicUnmatched: problematicUnmatched.length
    },
    problematicComponents,
    problematicUnmatched
  };

  fs.writeFileSync('audit_report.json', JSON.stringify(report, null, 2));
  
  let md = "# Database Integrity Audit Report\n\n";
  md += `**Generated on:** ${report.summary.timestamp}\n\n`;
  md += `### Summary\n`;
  md += `- **Total Components:** ${report.summary.totalComponents}\n`;
  md += `- **Problematic Components:** ${report.summary.problematicComponents}\n`;
  md += `- **Total Unmatched Pending:** ${report.summary.totalUnmatchedPending}\n`;
  md += `- **Problematic Unmatched:** ${report.summary.problematicUnmatched}\n\n`;

  md += "## Problematic Components in Catalog\n\n";
  if (problematicComponents.length === 0) {
    md += "No issues found.\n";
  } else {
    md += "| ID | Name | Current Category | Issue |\n";
    md += "|----|------|------------------|-------|\n";
    problematicComponents.forEach(c => {
      md += `| ${c.id} | ${c.name} | ${c.category} | ${c.issue} |\n`;
    });
  }

  md += "\n## Problematic Unmatched Listings (Pending Review)\n\n";
  if (problematicUnmatched.length === 0) {
    md += "No issues found.\n";
  } else {
    md += "| ID | Name | Suggested Category | Issue |\n";
    md += "|----|------|--------------------|-------|\n";
    problematicUnmatched.forEach(u => {
      md += `| ${u.id} | ${u.name} | ${u.suggested_category} | ${u.issue} |\n`;
    });
  }

  fs.writeFileSync('audit_report.md', md);

  console.log(`Audit complete. Found ${problematicComponents.length + problematicUnmatched.length} issues.`);
}

runAudit().catch(console.error).finally(() => process.exit());

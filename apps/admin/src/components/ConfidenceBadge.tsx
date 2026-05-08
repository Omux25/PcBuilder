/**
 * ConfidenceBadge — displays the suggestion engine's confidence level
 * alongside the suggested category for an unmatched listing group.
 *
 * Requirements: 11.1–11.5
 */

import { CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';

interface Props {
    confidence: 'high' | 'medium' | 'low' | 'unknown';
    category: string | null;
}

const CONFIDENCE_STYLES: Record<string, React.CSSProperties> = {
    high: {
        background: 'transparent',
        color: 'var(--accent-blue)',
        border: '1px solid var(--accent-blue)',
    },
    medium: {
        background: 'transparent',
        color: 'var(--warning)',
        border: '1px solid var(--warning)',
    },
    low: {
        background: 'transparent',
        color: 'var(--text-muted)',
        border: '1px solid var(--border-2)',
    },
    unknown: {
        background: 'transparent',
        color: 'var(--text-muted)',
        border: '1px solid var(--border-2)',
    },
};

const CONFIDENCE_LABELS: Record<string, string> = {
    high: '✓',
    medium: '~',
    low: '?',
    unknown: '?',
};

export function ConfidenceBadge({ confidence, category }: Props) {
    const style = CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.unknown;
    const indicator = CONFIDENCE_LABELS[confidence] ?? '?';

    const categoryLabel = category
        ? (CATEGORY_LABELS[category as ComponentCategory] ?? category)
        : 'Inconnu';

    const isUnknown = confidence === 'low' || confidence === 'unknown' || !category;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                ...style,
            }}
            title={`Confiance: ${confidence}`}
            aria-label={`Catégorie suggérée: ${isUnknown ? 'Inconnue' : categoryLabel}, confiance: ${confidence}`}
        >
            <span style={{ fontSize: '10px' }}>{indicator}</span>
            {isUnknown ? 'Inconnu' : categoryLabel}
        </span>
    );
}

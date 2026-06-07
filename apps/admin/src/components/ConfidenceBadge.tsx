/**
 * ConfidenceBadge — displays the suggestion engine's confidence level
 * alongside the suggested category for an unmatched listing group.
 *
 * Requirements: 11.1–11.5
 */


interface Props {
    confidence: 'high' | 'medium' | 'low' | 'unknown';
}

const CONFIDENCE_STYLES: Record<string, React.CSSProperties> = {
    high: {
        background: 'rgba(34, 197, 94, 0.15)',
        color: '#4ade80',
        border: '1px solid rgba(34, 197, 94, 0.2)',
    },
    medium: {
        background: 'rgba(245, 158, 11, 0.15)',
        color: '#fbbf24',
        border: '1px solid rgba(245, 158, 11, 0.2)',
    },
    low: {
        background: 'rgba(156, 163, 175, 0.1)',
        color: '#9ca3af',
        border: '1px solid rgba(156, 163, 175, 0.2)',
    },
    unknown: {
        background: 'rgba(156, 163, 175, 0.05)',
        color: 'var(--text-muted)',
        border: '1px solid rgba(156, 163, 175, 0.1)',
    },
};

const CONFIDENCE_LABELS: Record<string, string> = {
    high: '✓',
    medium: '•',
    low: '?',
    unknown: '?',
};

const CONFIDENCE_TEXT: Record<string, string> = {
    high: 'Élevée',
    medium: 'Moyenne',
    low: 'Faible',
    unknown: 'Inconnue',
};

export function ConfidenceBadge({ confidence }: Props) {
    const style = CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.unknown;
    const indicator = CONFIDENCE_LABELS[confidence] ?? '?';
    const text = CONFIDENCE_TEXT[confidence] ?? 'Inconnue';

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
            title={`Confiance: ${text}`}
            aria-label={`Confiance: ${text}`}
        >
            <span style={{ fontSize: '10px' }}>{indicator}</span>
            {text}
        </span>
    );
}

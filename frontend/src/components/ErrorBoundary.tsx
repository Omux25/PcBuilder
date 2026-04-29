import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary — catches any unhandled React render error
 * and shows a friendly fallback instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}>
          <h1 style={{ fontSize: '1.4rem', color: 'var(--text)' }}>
            Une erreur inattendue s'est produite
          </h1>
          <p style={{ maxWidth: '400px', lineHeight: 1.6 }}>
            Quelque chose s'est mal passé. Essayez de recharger la page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              padding: '0.6rem 1.5rem',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            Recharger la page
          </button>
          {this.state.error && (
            <details style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: '500px' }}>
              <summary style={{ cursor: 'pointer' }}>Détails techniques</summary>
              <pre style={{ marginTop: '0.5rem', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

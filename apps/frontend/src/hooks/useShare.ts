import { useState, useCallback } from 'react';

export function useShare() {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback((urlOrEvent?: string | React.MouseEvent, optionalUrl?: string) => {
    let url = window.location.href;

    if (typeof urlOrEvent === 'string') {
      url = urlOrEvent;
    } else if (urlOrEvent && typeof urlOrEvent === 'object' && 'preventDefault' in urlOrEvent) {
      urlOrEvent.preventDefault();
      if (optionalUrl) {
        url = optionalUrl;
      }
    }

    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return { copied, handleShare };
}

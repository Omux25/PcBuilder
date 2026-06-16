import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { env } from '../config/env';

export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Send a non-blocking tracking request to the backend
    fetch(`${env.API_URL}/traffic/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path: location.pathname }),
      // keepalive ensures the request finishes even if the user closes the tab
      keepalive: true
    }).catch(() => {
      // Silently ignore tracking errors so they don't pollute the console
    });
  }, [location.pathname]);

  return null;
}

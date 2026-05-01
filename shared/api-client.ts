/**
 * Shared API request factory for Frontend and Admin.
 * Handles base URL, common headers, and standard error parsing.
 */

export interface RequestOptions extends RequestInit {
  baseUrl?: string;
  token?: string | null;
  credentials?: RequestCredentials;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

/**
 * Creates a reusable request function for a specific API base.
 */
export function createRequest(defaultBaseUrl: string) {
  return async function request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { baseUrl, token, ...init } = options;
    const url = `${baseUrl ?? defaultBaseUrl}${path}`;

    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(url, {
      ...init,
      headers,
    });

    // Parse JSON safely
    let data: any;
    const contentType = res.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
      data = await res.json();
    } else {
      data = { message: await res.text() };
    }

    if (!res.ok) {
      const error: ApiError = {
        message: data?.error?.message ?? data?.message ?? `HTTP ${res.status}`,
        status: res.status,
        code: data?.error?.code,
      };
      throw error;
    }

    return data as T;
  };
}

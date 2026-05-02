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
    let data: unknown;
    const contentType = res.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
      data = await res.json();
    } else {
      data = { message: await res.text() };
    }

    if (!res.ok) {
      const errData = data as Record<string, unknown> | null;
      const errObj = errData?.error as Record<string, unknown> | undefined;
      const error: ApiError = {
        message: (errObj?.message ?? errData?.message ?? `HTTP ${res.status}`) as string,
        status: res.status,
        code: errObj?.code as string | undefined,
      };
      throw error;
    }

    return data as T;
  };
}

import type { AuditEvent, AuthFormState, AuthResponse, Message, MessageDraft, User } from '../types';

const createUrl = (baseUrl: string, path: string): string => {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ''), normalizedBaseUrl).toString();
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    return `Request failed with status ${response.status}.`;
  }

  return `Request failed with status ${response.status}.`;
};

const fetchJson = async <T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(createUrl(baseUrl, path), {
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
};

const fetchVoid = async (baseUrl: string, path: string, init?: RequestInit): Promise<void> => {
  const response = await fetch(createUrl(baseUrl, path), {
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
};

const authHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`
});

export const checkHealth = async (baseUrl: string): Promise<boolean> => {
  const response = await fetch(createUrl(baseUrl, '/healthz'));
  return response.ok;
};

export const registerUser = async (
  baseUrl: string,
  payload: AuthFormState
): Promise<AuthResponse> =>
  fetchJson<AuthResponse>(baseUrl, '/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

export const loginUser = async (baseUrl: string, payload: AuthFormState): Promise<AuthResponse> =>
  fetchJson<AuthResponse>(baseUrl, '/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

export const loadCurrentUser = async (baseUrl: string, token: string): Promise<User> =>
  fetchJson<User>(baseUrl, '/auth/me', {
    headers: {
      ...authHeaders(token)
    }
  });

export const loadMessages = async (baseUrl: string, token: string): Promise<Message[]> =>
  fetchJson<Message[]>(baseUrl, '/messages', {
    headers: {
      ...authHeaders(token)
    }
  });

export const createMessage = async (
  baseUrl: string,
  token: string,
  draft: MessageDraft
): Promise<Message> =>
  fetchJson<Message>(baseUrl, '/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token)
    },
    body: JSON.stringify({
      title: draft.title,
      body: draft.body,
      recipient_email: draft.recipient_email,
      expires_at: draft.expires_at || null
    })
  });

export const updateMessage = async (
  baseUrl: string,
  token: string,
  messageId: string,
  draft: MessageDraft
): Promise<Message> =>
  fetchJson<Message>(baseUrl, `/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token)
    },
    body: JSON.stringify({
      title: draft.title,
      body: draft.body,
      recipient_email: draft.recipient_email,
      status: draft.status,
      expires_at: draft.expires_at || null
    })
  });

export const deleteMessage = async (baseUrl: string, token: string, messageId: string): Promise<void> =>
  fetchVoid(baseUrl, `/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(token)
    }
  });

export const loadAuditEvents = async (baseUrl: string, token: string): Promise<AuditEvent[]> =>
  fetchJson<AuditEvent[]>(baseUrl, '/audit-events', {
    headers: {
      ...authHeaders(token)
    }
  });

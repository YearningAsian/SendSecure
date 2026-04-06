import type { ActivityItem, DashboardPayload, TransferDraft, TransferResponse } from '../types';

const createUrl = (baseUrl: string, path: string): string => {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ''), normalizedBaseUrl).toString();
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
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
};

export const loadDashboard = async (baseUrl: string): Promise<DashboardPayload> =>
  fetchJson<DashboardPayload>(baseUrl, '/dashboard');

export const submitTransferRequest = async (
  baseUrl: string,
  draft: TransferDraft
): Promise<TransferResponse> =>
  fetchJson<TransferResponse>(baseUrl, '/transfer-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(draft)
  });

export const normalizeActivity = (items: unknown): ActivityItem[] =>
  Array.isArray(items)
    ? items.filter((item): item is ActivityItem => typeof item === 'object' && item !== null)
    : [];

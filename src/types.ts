export type DashboardMetric = {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'success' | 'warning';
};

export type ActivityItem = {
  id: string;
  title: string;
  status: string;
  timestamp: string;
  description?: string;
};

export type SecurityCheck = {
  name: string;
  state: string;
  detail?: string;
};

export type DashboardPayload = {
  metrics?: DashboardMetric[];
  activity?: ActivityItem[];
  security?: SecurityCheck[];
};

export type TransferDraft = {
  recipient: string;
  subject: string;
  expiry: string;
  accessCode: string;
  note: string;
  attachmentName: string;
};

export type TransferResponse = {
  id: string;
  status: string;
  message?: string;
};

export type User = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type MessageStatus = 'draft' | 'active' | 'archived';

export type Message = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  recipient_email: string;
  status: MessageStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditEvent = {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, string>;
  created_at: string;
};

export type AuthFormState = {
  email: string;
  password: string;
};

export type MessageDraft = {
  title: string;
  body: string;
  recipient_email: string;
  status: MessageStatus;
  expires_at: string;
};

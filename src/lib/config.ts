const readEnv = (key: string): string | undefined => {
  const value = import.meta.env[key];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeBaseUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  return value.replace(/\/+$/, '');
};

export const appConfig = {
  appName: readEnv('VITE_APP_NAME') ?? 'SendSecure',
  appTagline:
    readEnv('VITE_APP_TAGLINE') ?? 'Secure delivery workspace for sensitive transfers.',
  apiBaseUrl: normalizeBaseUrl(readEnv('VITE_API_BASE_URL')),
  supportEmail: readEnv('VITE_SUPPORT_EMAIL'),
  docsUrl: readEnv('VITE_DOCS_URL')
};

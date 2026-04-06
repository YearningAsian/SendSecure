import { useEffect, useState } from 'react';
import { appConfig } from './lib/config';
import { loadDashboard, submitTransferRequest } from './lib/api';
import type { ActivityItem, DashboardMetric, SecurityCheck, TransferDraft } from './types';

type WorkspaceState = {
  loading: boolean;
  connected: boolean;
  metrics: DashboardMetric[];
  activity: ActivityItem[];
  security: SecurityCheck[];
  message: string;
};

type SubmissionState = {
  pending: boolean;
  message: string;
};

const emptyDraft: TransferDraft = {
  recipient: '',
  subject: '',
  expiry: '',
  accessCode: '',
  note: '',
  attachmentName: ''
};

function App() {
  const [draft, setDraft] = useState<TransferDraft>(emptyDraft);
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    loading: Boolean(appConfig.apiBaseUrl),
    connected: Boolean(appConfig.apiBaseUrl),
    metrics: [],
    activity: [],
    security: [],
    message: appConfig.apiBaseUrl
      ? 'Loading live dashboard data from the configured API.'
      : 'Set VITE_API_BASE_URL to connect this frontend to the backend.'
  });
  const [submission, setSubmission] = useState<SubmissionState>({
    pending: false,
    message: 'Ready to prepare a secure transfer request.'
  });

  useEffect(() => {
    if (!appConfig.apiBaseUrl) {
      return;
    }

    let active = true;

    const loadWorkspace = async (): Promise<void> => {
      try {
        const data = await loadDashboard(appConfig.apiBaseUrl!);

        if (!active) {
          return;
        }

        setWorkspace({
          loading: false,
          connected: true,
          metrics: data.metrics ?? [],
          activity: data.activity ?? [],
          security: data.security ?? [],
          message: 'Live dashboard data loaded from the configured API.'
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setWorkspace({
          loading: false,
          connected: false,
          metrics: [],
          activity: [],
          security: [],
          message: error instanceof Error ? error.message : 'Unable to load dashboard data.'
        });
      }
    };

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  const handleFieldChange =
    (field: keyof TransferDraft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setDraft((current) => ({ ...current, [field]: value }));
    };

  const handleAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setDraft((current) => ({
      ...current,
      attachmentName: file?.name ?? ''
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!appConfig.apiBaseUrl) {
      setSubmission({
        pending: false,
        message: 'Add VITE_API_BASE_URL to connect transfer submission to the backend.'
      });
      return;
    }

    setSubmission({ pending: true, message: 'Submitting transfer request...' });

    try {
      const response = await submitTransferRequest(appConfig.apiBaseUrl, draft);
      setSubmission({
        pending: false,
        message: response.message ?? `Transfer request ${response.id} saved as ${response.status}.`
      });
      setDraft(emptyDraft);
    } catch (error) {
      setSubmission({
        pending: false,
        message: error instanceof Error ? error.message : 'Transfer submission failed.'
      });
    }
  };

  return (
    <div className="app-shell">
      <div className="app-backdrop" aria-hidden="true" />
      <header className="topbar">
        <div>
          <p className="eyebrow">{appConfig.appName}</p>
          <h1>{appConfig.appTagline}</h1>
        </div>
        <div className="topbar-status" aria-label="Workspace status">
          <span className={`status-dot ${workspace.connected ? 'status-dot--live' : ''}`} />
          {workspace.connected ? 'Connected to live data' : 'Disconnected from API'}
        </div>
      </header>

      <main className="content-grid">
        <section className="hero card">
          <div className="hero-copy">
            <p className="section-label">Phase 2</p>
            <h2>Turn the shell into a live transfer workspace.</h2>
            <p>{workspace.message}</p>
          </div>
          <div className="hero-points">
            <div>
              <span className="point-value">{workspace.loading ? 'Loading' : 'Live state'}</span>
              <span className="point-label">Dashboard data is environment-driven.</span>
            </div>
            <div>
              <span className="point-value">{appConfig.apiBaseUrl ?? 'Unset'}</span>
              <span className="point-label">API endpoint resolved from runtime config.</span>
            </div>
            <div>
              <span className="point-value">No mock data</span>
              <span className="point-label">Panels render live data or empty states only.</span>
            </div>
          </div>
        </section>

        <section className="card composer-card">
          <div className="section-header">
            <div>
              <p className="section-label">Transfer composer</p>
              <h3>Prepare a secure delivery request.</h3>
            </div>
            <span className="pill">{submission.pending ? 'Submitting' : 'Ready'}</span>
          </div>

          <form className="composer-form" onSubmit={handleSubmit}>
            <label>
              <span>Recipient</span>
              <input
                type="email"
                value={draft.recipient}
                onChange={handleFieldChange('recipient')}
                placeholder="recipient@company.com"
                autoComplete="email"
              />
            </label>
            <label>
              <span>Subject</span>
              <input
                type="text"
                value={draft.subject}
                onChange={handleFieldChange('subject')}
                placeholder="Transfer title"
                autoComplete="off"
              />
            </label>
            <label>
              <span>Expiry</span>
              <input
                type="text"
                value={draft.expiry}
                onChange={handleFieldChange('expiry')}
                placeholder="Set by policy"
                autoComplete="off"
              />
            </label>
            <label>
              <span>Access code</span>
              <input
                type="password"
                value={draft.accessCode}
                onChange={handleFieldChange('accessCode')}
                placeholder="Generated by policy"
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>Transfer note</span>
              <textarea
                className="transfer-note"
                value={draft.note}
                onChange={handleFieldChange('note')}
                placeholder="Add instructions for the recipient."
                rows={4}
              />
            </label>
            <label className="composer-file">
              <span>Payload</span>
              <input type="file" onChange={handleAttachment} />
              <div className="file-dropzone">
                <strong>{draft.attachmentName || 'No file selected'}</strong>
                <span>Use runtime validation and API storage in the next phase.</span>
              </div>
            </label>
            <button type="submit" className="primary-action" disabled={submission.pending}>
              {submission.pending ? 'Submitting request...' : 'Submit transfer request'}
            </button>
            <p className="feedback-text">{submission.message}</p>
          </form>
        </section>

        <section className="card state-card">
          <div className="section-header">
            <div>
              <p className="section-label">Live metrics</p>
              <h3>Operational view.</h3>
            </div>
          </div>

          <div className="environment-grid">
            <article className="environment-card">
              <span className="state-title">API endpoint</span>
              <span className="state-copy">{appConfig.apiBaseUrl ?? 'Unset'}</span>
            </article>
            <article className="environment-card">
              <span className="state-title">Support contact</span>
              <span className="state-copy">{appConfig.supportEmail ?? 'Unset'}</span>
            </article>
            <article className="environment-card">
              <span className="state-title">Documentation</span>
              {appConfig.docsUrl ? (
                <a href={appConfig.docsUrl} target="_blank" rel="noreferrer">
                  Open docs
                </a>
              ) : (
                <span className="state-copy">Unset</span>
              )}
            </article>
          </div>

          <div className="metric-grid">
            {workspace.metrics.length > 0 ? (
              workspace.metrics.map((metric) => (
                <article key={metric.label} className="metric-card">
                  <span className="state-title">{metric.label}</span>
                  <strong>{metric.value}</strong>
                  {metric.detail ? <span className="state-copy">{metric.detail}</span> : null}
                </article>
              ))
            ) : (
              <article className="empty-state">
                <span className="state-title">Metrics</span>
                <span className="state-copy">
                  No live metric payload yet. Add the dashboard endpoint to populate this view.
                </span>
              </article>
            )}
          </div>

          <div className="state-list">
            <article>
              <span className="state-title">Activity</span>
              {workspace.activity.length > 0 ? (
                <div className="activity-feed">
                  {workspace.activity.map((item) => (
                    <div key={item.id} className="activity-item">
                      <strong>{item.title}</strong>
                      <span>{item.status}</span>
                      <p>{item.description ?? item.timestamp}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="state-copy">Activity will appear when the API returns entries.</span>
              )}
            </article>
            <article>
              <span className="state-title">Security checks</span>
              {workspace.security.length > 0 ? (
                <div className="activity-feed">
                  {workspace.security.map((check) => (
                    <div key={check.name} className="activity-item">
                      <strong>{check.name}</strong>
                      <span>{check.state}</span>
                      <p>{check.detail ?? 'Configured at runtime.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="state-copy">Security controls will be listed here from the backend.</span>
              )}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

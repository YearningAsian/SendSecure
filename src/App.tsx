import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { appConfig } from './lib/config';
import {
	checkHealth,
	createMessage,
	deleteMessage,
	loadAuditEvents,
	loadCurrentUser,
	loadMessages,
	loginUser,
	registerUser,
	updateMessage
} from './lib/api';
import type {
	AuditEvent,
	AuthFormState,
	Message,
	MessageDraft,
	MessagePayload,
	MessageStatus,
	User
} from './types';

const tokenStorageKey = 'sendsec.auth.token';

const emptyAuthForm: AuthFormState = {
	email: '',
	password: ''
};

const emptyMessageDraft: MessageDraft = {
	title: '',
	body: '',
	recipient_email: '',
	status: 'draft',
	expires_at: ''
};

const statusOptions: MessageStatus[] = ['draft', 'active', 'archived'];

const readStoredToken = (): string | null => {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.localStorage.getItem(tokenStorageKey);
};

const storeToken = (token: string | null): void => {
	if (typeof window === 'undefined') {
		return;
	}

	if (token) {
		window.localStorage.setItem(tokenStorageKey, token);
		return;
	}

	window.localStorage.removeItem(tokenStorageKey);
};

const formatDateTime = (value: string): string => {
	const parsedDate = new Date(value);
	if (Number.isNaN(parsedDate.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(parsedDate);
};

const toDateTimeLocalValue = (value: string | null): string => {
	if (!value) {
		return '';
	}

	const parsedDate = new Date(value);
	if (Number.isNaN(parsedDate.getTime())) {
		return '';
	}

	const offsetMilliseconds = parsedDate.getTimezoneOffset() * 60_000;
	return new Date(parsedDate.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
};

const toIsoTimestamp = (value: string): string => {
	const parsedDate = new Date(value);
	if (Number.isNaN(parsedDate.getTime())) {
		throw new Error('Expiry must be a valid date and time.');
	}

	return parsedDate.toISOString();
};

function App() {
	const apiBaseUrl = appConfig.apiBaseUrl;
	const [healthState, setHealthState] = useState({
		loading: Boolean(apiBaseUrl),
		healthy: Boolean(apiBaseUrl),
		message: apiBaseUrl
			? 'Checking backend availability.'
			: 'Set VITE_API_BASE_URL to connect the frontend to the backend.'
	});
	const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
	const [authForm, setAuthForm] = useState<AuthFormState>(emptyAuthForm);
	const [authPending, setAuthPending] = useState(false);
	const [authMessage, setAuthMessage] = useState('Sign in or create an account to load secure messages.');
	const [sessionToken, setSessionToken] = useState<string | null>(() => readStoredToken());
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [workspaceLoading, setWorkspaceLoading] = useState(false);
	const [workspaceMessage, setWorkspaceMessage] = useState('Authenticate to load messages and audit events.');
	const [messages, setMessages] = useState<Message[]>([]);
	const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
	const [messageDraft, setMessageDraft] = useState<MessageDraft>(emptyMessageDraft);
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const [messagePending, setMessagePending] = useState(false);
	const [messageMessage, setMessageMessage] = useState('Compose a secure message to begin.');

	useEffect(() => {
		if (!apiBaseUrl) {
			setHealthState({
				loading: false,
				healthy: false,
				message: 'Set VITE_API_BASE_URL to connect the frontend to the backend.'
			});
			return;
		}

		let active = true;

		const loadHealth = async (): Promise<void> => {
			try {
				const healthy = await checkHealth(apiBaseUrl);
				if (!active) {
					return;
				}

				setHealthState({
					loading: false,
					healthy,
					message: healthy
						? 'Backend is reachable and ready for browser requests.'
						: 'Backend responded, but it is not healthy yet.'
				});
			} catch (error) {
				if (!active) {
					return;
				}

				setHealthState({
					loading: false,
					healthy: false,
					message: error instanceof Error ? error.message : 'Unable to reach the backend.'
				});
			}
		};

		void loadHealth();

		return () => {
			active = false;
		};
	}, [apiBaseUrl]);

	useEffect(() => {
		if (!apiBaseUrl) {
			setCurrentUser(null);
			setMessages([]);
			setAuditEvents([]);
			setWorkspaceLoading(false);
			setWorkspaceMessage('Set VITE_API_BASE_URL to load secured data.');
			return;
		}

		if (!sessionToken) {
			setCurrentUser(null);
			setMessages([]);
			setAuditEvents([]);
			setWorkspaceLoading(false);
			setWorkspaceMessage('Sign in to view your secure messages and audit trail.');
			return;
		}

		let active = true;

		const loadWorkspace = async (): Promise<void> => {
			setWorkspaceLoading(true);
			setWorkspaceMessage('Loading your secure workspace.');

			try {
				const [user, loadedMessages, loadedAuditEvents] = await Promise.all([
					loadCurrentUser(apiBaseUrl, sessionToken),
					loadMessages(apiBaseUrl, sessionToken),
					loadAuditEvents(apiBaseUrl, sessionToken)
				]);

				if (!active) {
					return;
				}

				setCurrentUser(user);
				setMessages(loadedMessages);
				setAuditEvents(loadedAuditEvents);
				setWorkspaceMessage(
					loadedMessages.length > 0
						? 'Live secure messages loaded from the backend.'
						: 'You are authenticated, but no secure messages exist yet.'
				);
			} catch (error) {
				if (!active) {
					return;
				}

				setSessionToken(null);
				storeToken(null);
				setCurrentUser(null);
				setMessages([]);
				setAuditEvents([]);
				setWorkspaceMessage(error instanceof Error ? error.message : 'Failed to load workspace data.');
			} finally {
				if (active) {
					setWorkspaceLoading(false);
				}
			}
		};

		void loadWorkspace();

		return () => {
			active = false;
		};
	}, [apiBaseUrl, sessionToken]);

	const handleAuthFieldChange =
		(field: keyof AuthFormState) =>
		(event: ChangeEvent<HTMLInputElement>) => {
			const { value } = event.target;
			setAuthForm((current) => ({ ...current, [field]: value }));
		};

	const handleDraftChange =
		(field: keyof MessageDraft) =>
		(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
			const { value } = event.target;
			setMessageDraft((current) => ({ ...current, [field]: value }));
		};

	const loadMessageIntoForm = (message: Message): void => {
		setEditingMessageId(message.id);
		setMessageDraft({
			title: message.title,
			body: message.body,
			recipient_email: message.recipient_email,
			status: message.status,
			expires_at: toDateTimeLocalValue(message.expires_at)
		});
		setMessageMessage(`Editing message ${message.title}.`);
	};

	const resetMessageForm = (): void => {
		setEditingMessageId(null);
		setMessageDraft(emptyMessageDraft);
	};

	const refreshWorkspace = async (token: string): Promise<void> => {
		if (!apiBaseUrl) {
			return;
		}

		const [user, loadedMessages, loadedAuditEvents] = await Promise.all([
			loadCurrentUser(apiBaseUrl, token),
			loadMessages(apiBaseUrl, token),
			loadAuditEvents(apiBaseUrl, token)
		]);

		setCurrentUser(user);
		setMessages(loadedMessages);
		setAuditEvents(loadedAuditEvents);
		setWorkspaceMessage(
			loadedMessages.length > 0
				? 'Live secure messages loaded from the backend.'
				: 'You are authenticated, but no secure messages exist yet.'
		);
	};

	const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!apiBaseUrl) {
			setAuthMessage('Set VITE_API_BASE_URL to connect authentication to the backend.');
			return;
		}

		setAuthPending(true);
		setAuthMessage(authMode === 'register' ? 'Creating account...' : 'Signing in...');

		try {
			const response =
				authMode === 'register'
					? await registerUser(apiBaseUrl, authForm)
					: await loginUser(apiBaseUrl, authForm);

			setSessionToken(response.access_token);
			storeToken(response.access_token);
			setCurrentUser(response.user);
			setAuthMessage(
				authMode === 'register'
					? `Account created for ${response.user.email}.`
					: `Signed in as ${response.user.email}.`
			);
			setAuthForm(emptyAuthForm);
			await refreshWorkspace(response.access_token);
		} catch (error) {
			setAuthMessage(error instanceof Error ? error.message : 'Authentication failed.');
		} finally {
			setAuthPending(false);
		}
	};

	const handleMessageSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!apiBaseUrl || !sessionToken) {
			setMessageMessage('Sign in and set VITE_API_BASE_URL before creating secure messages.');
			return;
		}

		setMessagePending(true);
		setMessageMessage(editingMessageId ? 'Updating secure message...' : 'Creating secure message...');

		try {
			const payload: MessagePayload = {
				...messageDraft,
				expires_at: messageDraft.expires_at ? toIsoTimestamp(messageDraft.expires_at) : null
			};

			if (editingMessageId) {
				await updateMessage(apiBaseUrl, sessionToken, editingMessageId, payload);
				setMessageMessage('Secure message updated.');
			} else {
				await createMessage(apiBaseUrl, sessionToken, payload);
				setMessageMessage('Secure message created.');
			}

			resetMessageForm();
			await refreshWorkspace(sessionToken);
		} catch (error) {
			setMessageMessage(error instanceof Error ? error.message : 'Secure message submission failed.');
		} finally {
			setMessagePending(false);
		}
	};

	const handleDeleteMessage = async (messageId: string): Promise<void> => {
		if (!apiBaseUrl || !sessionToken) {
			return;
		}

		const targetMessage = messages.find((entry) => entry.id === messageId);
		if (targetMessage && typeof window !== 'undefined') {
			const confirmed = window.confirm(`Delete \"${targetMessage.title}\"?`);
			if (!confirmed) {
				return;
			}
		}

		setMessagePending(true);
		setMessageMessage('Deleting secure message...');

		try {
			await deleteMessage(apiBaseUrl, sessionToken, messageId);
			if (editingMessageId === messageId) {
				resetMessageForm();
			}
			setMessageMessage('Secure message deleted.');
			await refreshWorkspace(sessionToken);
		} catch (error) {
			setMessageMessage(error instanceof Error ? error.message : 'Secure message deletion failed.');
		} finally {
			setMessagePending(false);
		}
	};

	const handleSignOut = (): void => {
		setSessionToken(null);
		storeToken(null);
		setCurrentUser(null);
		setMessages([]);
		setAuditEvents([]);
		resetMessageForm();
		setAuthMessage('Signed out. Authenticate again to resume work.');
		setWorkspaceMessage('Session cleared.');
	};

	const connectionLabel = healthState.loading
		? 'Checking backend'
		: healthState.healthy
			? 'Connected'
			: 'Disconnected';

	return (
		<div className="app-shell">
			<div className="app-backdrop" aria-hidden="true" />
			<header className="topbar">
				<div>
					<p className="eyebrow">{appConfig.appName}</p>
					<h1>{appConfig.appTagline}</h1>
				</div>
				<div className="topbar-status" aria-label="Backend connection status">
					<span className={`status-dot ${healthState.healthy ? 'status-dot--live' : ''}`} />
					{connectionLabel}
				</div>
			</header>

			<main className="content-grid">
				<section className="hero card">
					<div className="hero-copy">
						<p className="section-label">Runtime control</p>
						<h2>Authenticate, compose, and review secure messages against the live API.</h2>
						<p>{healthState.message}</p>
					</div>
					<div className="hero-points">
						<div>
							<span className="point-value">{apiBaseUrl ?? 'Unset'}</span>
							<span className="point-label">Backend base URL from runtime configuration.</span>
						</div>
						<div>
							<span className="point-value">{currentUser?.email ?? 'Signed out'}</span>
							<span className="point-label">Current authenticated session.</span>
						</div>
						<div>
							<span className="point-value">{messages.length}</span>
							<span className="point-label">Messages loaded from the backend.</span>
						</div>
						<div>
							<span className="point-value">{auditEvents.length}</span>
							<span className="point-label">Audit events currently visible.</span>
						</div>
					</div>
				</section>

				<section className="card auth-card">
					<div className="section-header">
						<div>
							<p className="section-label">Authentication</p>
							<h3>Sign in or register a secure workspace user.</h3>
						</div>
						<span className="pill">{authMode === 'register' ? 'Register' : 'Login'}</span>
					</div>

					<div className="toggle-row" role="tablist" aria-label="Authentication mode">
						<button
							type="button"
							className={authMode === 'login' ? 'toggle-button toggle-button--active' : 'toggle-button'}
							onClick={() => setAuthMode('login')}
						>
							Login
						</button>
						<button
							type="button"
							className={authMode === 'register' ? 'toggle-button toggle-button--active' : 'toggle-button'}
							onClick={() => setAuthMode('register')}
						>
							Register
						</button>
					</div>

					<form className="auth-form" onSubmit={handleAuthSubmit}>
						<label>
							<span>Email</span>
							<input
								type="email"
								value={authForm.email}
								onChange={handleAuthFieldChange('email')}
								placeholder="user@example.com"
								autoComplete="email"
							/>
						</label>
						<label>
							<span>Password</span>
							<input
								type="password"
								value={authForm.password}
								onChange={handleAuthFieldChange('password')}
								placeholder="Enter a strong password"
								autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
							/>
						</label>
						<button type="submit" className="primary-action" disabled={authPending}>
							{authPending ? 'Working...' : authMode === 'register' ? 'Create account' : 'Sign in'}
						</button>
						<p className="feedback-text">{authMessage}</p>
					</form>

					<div className="environment-grid auth-summary-grid">
						<article className="environment-card">
							<span className="state-title">Session</span>
							<span className="state-copy">{currentUser ? `Logged in as ${currentUser.email}` : 'No active session'}</span>
						</article>
						<article className="environment-card">
							<span className="state-title">Support</span>
							{appConfig.supportEmail ? (
								<a href={`mailto:${appConfig.supportEmail}`}>{appConfig.supportEmail}</a>
							) : (
								<span className="state-copy">Unset</span>
							)}
						</article>
						<article className="environment-card">
							<span className="state-title">Docs</span>
							{appConfig.docsUrl ? (
								<a href={appConfig.docsUrl} target="_blank" rel="noreferrer">
									Open docs
								</a>
							) : (
								<span className="state-copy">Unset</span>
							)}
						</article>
					</div>

					{currentUser ? (
						<div className="current-user-panel">
							<div>
								<span className="state-title">Current user</span>
								<strong>{currentUser.email}</strong>
							</div>
							<div>
								<span className="state-title">Role</span>
								<strong>{currentUser.role}</strong>
							</div>
							<div>
								<span className="state-title">Joined</span>
								<strong>{formatDateTime(currentUser.created_at)}</strong>
							</div>
							<button type="button" className="secondary-action" onClick={handleSignOut}>
								Sign out
							</button>
						</div>
					) : null}
				</section>

				<section className="card workspace-card">
					<div className="section-header">
						<div>
							<p className="section-label">Messages</p>
							<h3>Compose and maintain secure message records.</h3>
						</div>
						<span className="pill">{editingMessageId ? 'Editing' : 'Create'}</span>
					</div>

					<form className="message-form" onSubmit={handleMessageSubmit}>
						<div className="field-grid">
							<label>
								<span>Title</span>
								<input
									type="text"
									value={messageDraft.title}
									onChange={handleDraftChange('title')}
									placeholder="Quarterly report"
								/>
							</label>
							<label>
								<span>Recipient</span>
								<input
									type="email"
									value={messageDraft.recipient_email}
									onChange={handleDraftChange('recipient_email')}
									placeholder="recipient@example.com"
									autoComplete="email"
								/>
							</label>
						</div>
						<div className="field-grid">
							<label>
								<span>Status</span>
								<select value={messageDraft.status} onChange={handleDraftChange('status')}>
									{statusOptions.map((status) => (
										<option key={status} value={status}>
											{status}
										</option>
									))}
								</select>
							</label>
							<label>
								<span>Expires at</span>
								<input
									type="datetime-local"
									value={messageDraft.expires_at}
									onChange={handleDraftChange('expires_at')}
								/>
							</label>
						</div>
						<label>
							<span>Body</span>
							<textarea
								className="transfer-note"
								value={messageDraft.body}
								onChange={handleDraftChange('body')}
								placeholder="Write the secure message body."
								rows={5}
							/>
						</label>
						<div className="action-row">
							<button type="submit" className="primary-action" disabled={messagePending || !sessionToken}>
								{messagePending ? 'Working...' : editingMessageId ? 'Update message' : 'Create message'}
							</button>
							{editingMessageId ? (
								<button type="button" className="secondary-action" onClick={resetMessageForm}>
									Cancel edit
								</button>
							) : null}
						</div>
						<p className="feedback-text">{messageMessage}</p>
					</form>

					<div className="section-header section-header--compact">
						<div>
							<p className="section-label">Secure inbox</p>
							<h3>{workspaceLoading ? 'Refreshing workspace...' : workspaceMessage}</h3>
						</div>
					</div>

					<div className="message-grid">
						{messages.length > 0 ? (
							messages.map((message) => (
								<article key={message.id} className="message-card">
									<div className="message-card__header">
										<div>
											<span className="state-title">{message.title}</span>
											<strong>{message.recipient_email}</strong>
										</div>
										<span className={`status-chip status-chip--${message.status}`}>{message.status}</span>
									</div>
									<p className="message-body">{message.body}</p>
									<div className="message-meta">
										<span>Created {formatDateTime(message.created_at)}</span>
										<span>Updated {formatDateTime(message.updated_at)}</span>
										<span>Expires {message.expires_at ? formatDateTime(message.expires_at) : 'Never'}</span>
									</div>
									<div className="message-actions">
										<button type="button" className="secondary-action" onClick={() => loadMessageIntoForm(message)}>
											Edit
										</button>
										<button
											type="button"
											className="danger-action"
											disabled={messagePending}
											onClick={() => void handleDeleteMessage(message.id)}
										>
											Delete
										</button>
									</div>
								</article>
							))
						) : (
							<article className="empty-state empty-state--full">
								<span className="state-title">No messages</span>
								<span className="state-copy">
									Create the first secure message after signing in to populate this workspace.
								</span>
							</article>
						)}
					</div>
				</section>

				<section className="card audit-card">
					<div className="section-header">
						<div>
							<p className="section-label">Audit trail</p>
							<h3>Review the security events captured by the API.</h3>
						</div>
						<span className="pill">{auditEvents.length} events</span>
					</div>

					<div className="audit-list">
						{auditEvents.length > 0 ? (
							auditEvents.map((event) => (
								<article key={event.id} className="audit-item">
									<div className="audit-item__header">
										<strong>{event.action}</strong>
										<span>{formatDateTime(event.created_at)}</span>
									</div>
									<div className="audit-item__details">
										<span>{event.resource_type}</span>
										<span>{event.resource_id ?? 'No resource ID'}</span>
										<span>{event.actor_id ?? 'System'}</span>
									</div>
									<p>{Object.entries(event.metadata).map(([key, value]) => `${key}: ${value}`).join(' | ')}</p>
								</article>
							))
						) : (
							<article className="empty-state empty-state--full">
								<span className="state-title">No events yet</span>
								<span className="state-copy">
									Auth and message changes will appear here after interacting with the backend.
								</span>
							</article>
						)}
					</div>
				</section>
			</main>
		</div>
	);
}

export default App;

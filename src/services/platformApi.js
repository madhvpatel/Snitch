import { API_BASE_URL } from './config';

export const PORTAL_TOKEN_STORAGE_KEY = 'snitch.portal.token';

const parseJsonOrThrow = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    throw new Error(payload.error || `${response.status} ${response.statusText}`.trim() || 'Request failed');
  }

  return payload;
};

const buildUrl = (path) => `${API_BASE_URL}${path}`;

const authHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

const jsonRequest = async (path, { method = 'GET', body, token } = {}) => {
  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(token),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseJsonOrThrow(response);
};

export const getDemoAccounts = () => jsonRequest('/api/auth/demo-accounts');
export const loginPortal = (payload) => jsonRequest('/api/auth/login', { method: 'POST', body: payload });
export const getPortalSession = (token) => jsonRequest('/api/auth/me', { token });

export const registerAnonymousInstall = (payload) => jsonRequest('/api/capture/install', { method: 'POST', body: payload });
export const createCaptureSession = (payload) => jsonRequest('/api/capture/session', { method: 'POST', body: payload });
export const startCaptureSession = (sessionId, payload) => jsonRequest(`/api/capture/session/${sessionId}/start`, { method: 'POST', body: payload });
export const createCaptureSubmission = (payload) => jsonRequest('/api/capture/submissions', { method: 'POST', body: payload });
export const finalizeCaptureSubmission = (submissionId, payload) => jsonRequest(`/api/capture/submissions/${submissionId}/finalize`, { method: 'POST', body: payload });
export const getCaptureSubmissionStatus = (submissionId) => jsonRequest(`/api/capture/submissions/${submissionId}/status`);
export const retryCaptureSubmission = (submissionId) => jsonRequest(`/api/capture/submissions/${submissionId}/retry`, { method: 'POST' });

export const syncCaptureClock = async () => {
  const startedAt = Date.now();
  const payload = await jsonRequest('/api/capture/time');
  const endedAt = Date.now();
  const midpoint = Math.round((startedAt + endedAt) / 2);
  return {
    ...payload,
    measuredOffsetMs: new Date(payload.serverTime).getTime() - midpoint,
    roundTripMs: endedAt - startedAt,
  };
};

export const uploadCaptureVideo = async ({ submissionId, uploadToken, videoBlob, fileName = 'capture.webm' }) => {
  const formData = new FormData();
  formData.append('video', videoBlob, fileName);

  const response = await fetch(buildUrl(`/api/capture/submissions/${submissionId}/upload`), {
    method: 'POST',
    headers: {
      'x-upload-token': uploadToken,
    },
    body: formData,
  });

  return parseJsonOrThrow(response);
};

export const getPortalDashboard = (token) => jsonRequest('/api/portal/dashboard', { token });
export const getPortalReports = (token, filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const suffix = params.toString() ? `?${params}` : '';
  return jsonRequest(`/api/portal/reports${suffix}`, { token });
};
export const getPortalReportDetail = (token, reportId) => jsonRequest(`/api/portal/reports/${reportId}`, { token });
export const reviewPortalReport = (token, reportId, payload) => jsonRequest(`/api/portal/reports/${reportId}/review`, { method: 'POST', token, body: payload });
export const savePortalSourceReview = (token, reportId, payload) => jsonRequest(`/api/portal/reports/${reportId}/source-review`, { method: 'POST', token, body: payload });
export const getPortalVenueDetail = (token, venueId) => jsonRequest(`/api/portal/venues/${venueId}`, { token });
export const createCasePacket = (token, payload) => jsonRequest('/api/portal/case-packets', { method: 'POST', token, body: payload });
export const recordPortalCaseOutcome = (token, caseId, payload) => jsonRequest(`/api/portal/cases/${caseId}/outcome`, { method: 'POST', token, body: payload });

export const getAdminDependencyHealth = (token) => jsonRequest('/api/admin/health/dependencies', { token });
export const getAdminAbuseQueue = (token) => jsonRequest('/api/admin/abuse-queue', { token });
export const getAdminRewardsOverview = (token) => jsonRequest('/api/admin/rewards/overview', { token });
export const importAdminCsv = (token, path, csv) => jsonRequest(path, { method: 'POST', token, body: { csv } });

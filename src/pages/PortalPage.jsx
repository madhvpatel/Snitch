import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Download, FileText, LogOut, MapPinned, ShieldCheck, TimerReset } from 'lucide-react';

import {
  PORTAL_TOKEN_STORAGE_KEY,
  createCasePacket,
  getDemoAccounts,
  getPortalDashboard,
  getPortalReportDetail,
  getPortalReports,
  getPortalSession,
  getPortalVenueDetail,
  loginPortal,
  recordPortalCaseOutcome,
  reviewPortalReport,
  savePortalSourceReview,
} from '../services/platformApi';

const verdictButtons = [
  { verdict: 'confirmed', label: 'Confirm', className: 'bg-emerald-300 text-slate-950 hover:bg-emerald-200' },
  { verdict: 'rejected', label: 'Reject', className: 'bg-rose-300 text-slate-950 hover:bg-rose-200' },
  { verdict: 'needs_manual_venue_match', label: 'Needs Venue Match', className: 'bg-amber-200 text-slate-950 hover:bg-amber-100' },
];
const sourceReviewOptions = [
  { value: 'likely_pa_system', label: 'Likely PA System' },
  { value: 'likely_small_speaker', label: 'Likely Small Speaker' },
  { value: 'likely_personal_device', label: 'Likely Personal Device' },
  { value: 'inconclusive', label: 'Inconclusive' },
];

const metricCardTone = [
  'border-cyan-300/20 bg-cyan-400/10',
  'border-amber-300/20 bg-amber-400/10',
  'border-emerald-300/20 bg-emerald-400/10',
  'border-fuchsia-300/20 bg-fuchsia-400/10',
];

const loadSavedToken = () => window.localStorage.getItem(PORTAL_TOKEN_STORAGE_KEY) || '';
const formatInr = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));
const formatSourceClass = (value) => (
  value
    ? value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    : 'Inconclusive'
);
const formatSignalValue = (value) => (
  typeof value === 'number'
    ? value.toFixed(value >= 10 ? 1 : 3).replace(/\.?0+$/, '')
    : 'n/a'
);
const formatPlaybackContext = (value) => (
  value
    ? value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    : 'Inconclusive'
);

const PLAYBACK_CUE_PATTERNS = [
  /\bspeaker\b/i,
  /\bsoundbar\b/i,
  /\bpa system\b/i,
  /\bpublic address\b/i,
  /\bamplifier\b/i,
  /\bamp\b/i,
  /\bmixer\b/i,
  /\bconsole\b/i,
  /\bdj\b/i,
  /\bturntable\b/i,
  /\bmicrophone\b/i,
  /\bmic\b/i,
  /\bsubwoofer\b/i,
  /\bwoofer\b/i,
  /\breceiver\b/i,
  /\baudio rack\b/i,
  /\bsound system\b/i,
  /\bceiling speaker\b/i,
  /\bwall[- ]mounted speaker\b/i,
  /\bmonitor speaker\b/i,
];

const getVisualCueBuckets = (items) => {
  const playbackCues = [];
  const sceneObjects = [];
  const seen = new Set();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = String(item || '').trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    if (PLAYBACK_CUE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      playbackCues.push(normalized);
      return;
    }

    sceneObjects.push(normalized);
  });

  return { playbackCues, sceneObjects };
};

export const PortalPage = () => {
  const [token, setToken] = useState(loadSavedToken);
  const [me, setMe] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedExportIds, setSelectedExportIds] = useState([]);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [exportUrl, setExportUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loginForm, setLoginForm] = useState({
    email: 'label@saregama.demo',
    password: 'snitch-demo-2026',
    totpCode: '',
  });
  const [reviewNotes, setReviewNotes] = useState('');
  const [sourceReviewForm, setSourceReviewForm] = useState({
    reviewedClass: '',
    notes: '',
  });
  const [sourceReviewSaving, setSourceReviewSaving] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({
    realizedValueInr: '',
    settlementSignedAt: new Date().toISOString().slice(0, 10),
    outcomeType: 'license_signed',
  });
  const sourceAnalysis = selectedReport?.sourceAnalysis || selectedReport?.submission?.sourceAnalysis || null;
  const evidencePackage = selectedReport?.evidencePackage || null;
  const visualAnalysis = selectedReport?.visualAnalysis || selectedReport?.submission?.visualAnalysis || evidencePackage?.visualContext || null;
  const visualCueBuckets = getVisualCueBuckets(visualAnalysis?.visibleEquipment);
  const evidenceVisualCueBuckets = getVisualCueBuckets(evidencePackage?.visualContext?.visibleEquipment);
  const sourceReview = selectedReport?.sourceReview || evidencePackage?.sourceAssessment?.reviewedSource || null;

  const scopedMetrics = useMemo(() => {
    if (!dashboard?.totals) {
      return [];
    }

    return [
      { label: 'Total Reports', value: dashboard.totals.totalReports },
      { label: 'Confirmed', value: dashboard.totals.confirmedReports },
      { label: 'Eligible Cases', value: dashboard.totals.eligibleCases },
      { label: 'Recoverable Value', value: formatInr(dashboard.totals.estimatedRecoverableValueInr) },
      { label: 'Realized Value', value: formatInr(dashboard.totals.realizedValueInr) },
      { label: 'Held Rewards', value: formatInr(dashboard.totals.heldRewardLiabilityInr) },
      { label: '7 / 30 / 90 Days', value: `${dashboard.totals.reportsLast7Days} / ${dashboard.totals.reportsLast30Days} / ${dashboard.totals.reportsLast90Days}` },
      { label: 'Confirmation Rate', value: `${Math.round((dashboard.totals.confirmationRate || 0) * 100)}%` },
    ];
  }, [dashboard]);

  const loadPortalData = useCallback(async (sessionToken) => {
    const [session, dashboardPayload, reportsPayload] = await Promise.all([
      getPortalSession(sessionToken),
      getPortalDashboard(sessionToken),
      getPortalReports(sessionToken, statusFilter ? { status: statusFilter } : {}),
    ]);

    setMe(session.user);
    setDashboard(dashboardPayload);
    setReports(reportsPayload.reports);
    const firstReportId = reportsPayload.reports[0]?.id || null;
    setSelectedReportId((current) => reportsPayload.reports.some((report) => report.id === current) ? current : firstReportId);
    setSelectedExportIds((current) => current.filter((reportId) => reportsPayload.reports.some((report) => report.id === reportId)));
  }, [statusFilter]);

  useEffect(() => {
    getDemoAccounts()
      .then((payload) => setDemoAccounts(payload.accounts || []))
      .catch(() => setDemoAccounts([]));
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    const load = async () => {
      try {
        await loadPortalData(token);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError.message);
        window.localStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
        setToken('');
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [loadPortalData, token]);

  useEffect(() => {
    if (!token || !selectedReportId) {
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const [reportPayload, venuePayload] = await Promise.all([
          getPortalReportDetail(token, selectedReportId),
          (async () => {
            const baseReport = reports.find((item) => item.id === selectedReportId);
            if (!baseReport?.venue?.id) {
              return null;
            }
            return getPortalVenueDetail(token, baseReport.venue.id);
          })(),
        ]);

        if (!active) {
          return;
        }

        setSelectedReport(reportPayload.report);
        setSelectedVenue(venuePayload);
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [reports, selectedReportId, token]);

  useEffect(() => {
    if (!selectedReport?.id) {
      setSourceReviewForm({ reviewedClass: '', notes: '' });
      return;
    }

    setSourceReviewForm({
      reviewedClass: selectedReport.sourceReview?.reviewedClass || selectedReport.sourceAnalysis?.sourceClass || '',
      notes: selectedReport.sourceReview?.notes || '',
    });
  }, [
    selectedReport?.id,
    selectedReport?.sourceReview?.reviewedClass,
    selectedReport?.sourceReview?.notes,
    selectedReport?.sourceAnalysis?.sourceClass,
  ]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);

    try {
      const session = await loginPortal(loginForm);
      window.localStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, session.token);
      setToken(session.token);
    } catch (loginError) {
      setError(loginError.message);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
    setToken('');
    setMe(null);
    setDashboard(null);
    setReports([]);
    setSelectedReport(null);
    setSelectedVenue(null);
    setSelectedExportIds([]);
  };

  const handleReview = async (verdict) => {
    if (!token || !selectedReport) {
      return;
    }

    try {
      await reviewPortalReport(token, selectedReport.id, {
        verdict,
        notes: reviewNotes,
        tags: verdict === 'confirmed' ? ['ready-for-export'] : [],
      });
      setReviewNotes('');
      await loadPortalData(token);
      setSelectedReportId(selectedReport.id);
    } catch (reviewError) {
      setError(reviewError.message);
    }
  };

  const handleSaveSourceReview = async () => {
    if (!token || !selectedReport || !sourceReviewForm.reviewedClass) {
      return;
    }

    setSourceReviewSaving(true);
    setError(null);

    try {
      await savePortalSourceReview(token, selectedReport.id, {
        reviewedClass: sourceReviewForm.reviewedClass,
        notes: sourceReviewForm.notes,
      });
      await loadPortalData(token);
      setSelectedReportId(selectedReport.id);
    } catch (sourceReviewError) {
      setError(sourceReviewError.message);
    } finally {
      setSourceReviewSaving(false);
    }
  };

  const handleExport = async () => {
    if (!token || !selectedExportIds.length) {
      return;
    }

    try {
      const payload = await createCasePacket(token, {
        reportIds: selectedExportIds,
      });
      setExportUrl(payload.exportUrl);
      await loadPortalData(token);
    } catch (exportError) {
      setError(exportError.message);
    }
  };

  const handleOutcomeSubmit = async (event) => {
    event.preventDefault();
    if (!token || !selectedReport?.case?.id) {
      return;
    }

    try {
      await recordPortalCaseOutcome(token, selectedReport.case.id, {
        realizedValueInr: Number(outcomeForm.realizedValueInr),
        settlementSignedAt: outcomeForm.settlementSignedAt,
        outcomeType: outcomeForm.outcomeType,
      });
      await loadPortalData(token);
      setSelectedReportId(selectedReport.id);
      setOutcomeForm((current) => ({
        ...current,
        realizedValueInr: '',
      }));
    } catch (outcomeError) {
      setError(outcomeError.message);
    }
  };

  if (!token) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100">Org Portal</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Label and collective workspaces.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            This portal filters reports by rights-owner org, exposes repeat-offender venue metrics, and lets analysts
            review or export case packets. The current build uses seeded local accounts with TOTP.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Email</span>
                <input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-0"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Password</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-0"
                />
              </label>
            </div>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">TOTP code</span>
              <input
                value={loginForm.totpCode}
                onChange={(event) => setLoginForm((current) => ({ ...current, totpCode: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-0"
                placeholder="123456"
              />
            </label>

            {error && <p className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

            <button type="submit" className="rounded-full bg-amber-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-100">
              Sign in to Portal
            </button>
          </form>
        </section>

        <aside className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex items-center gap-3 text-amber-100">
            <ShieldCheck size={18} />
            <p className="text-xs font-semibold uppercase tracking-[0.3em]">Seeded Demo Accounts</p>
          </div>
          <div className="mt-5 space-y-4">
            {demoAccounts.map((account) => (
              <div key={account.email} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <p className="font-semibold text-white">{account.org}</p>
                <p className="mt-2">{account.email}</p>
                <p className="text-slate-400">Role: {account.role}</p>
                <p className="mt-2 break-all font-mono text-xs text-slate-300">TOTP secret: {account.totpSecret}</p>
                <p className="mt-2 font-mono text-sm text-amber-100">Current code: {account.currentTotpCode || 'Unavailable'}</p>
                <p className="mt-1 text-xs text-slate-500">Refreshes every 30 seconds. Use this 6-digit code in the login form.</p>
                <button
                  type="button"
                  onClick={() => setLoginForm({
                    email: account.email,
                    password: 'snitch-demo-2026',
                    totpCode: account.currentTotpCode || '',
                  })}
                  className="mt-3 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/15"
                >
                  Use This Account
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-500">Default password: <span className="font-mono">snitch-demo-2026</span></p>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100">Rights Holder Portal</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              {me?.org?.name || 'Workspace'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Review org-scoped reports, monitor repeat-offender venues, and export case packets for off-platform action.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {scopedMetrics.map((metric, index) => (
            <div key={metric.label} className={`rounded-3xl border p-5 ${metricCardTone[index % metricCardTone.length]}`}>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-100/70">{metric.label}</p>
              <p className="mt-4 text-3xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      {error && <div className="rounded-3xl border border-rose-300/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Report Queue</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Analyst review queue</h2>
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white outline-none"
              >
                <option value="">All statuses</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Rejected</option>
                <option value="needs_manual_venue_match">Needs venue match</option>
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {reports.map((report) => {
                const selected = report.id === selectedReportId;
                const checked = selectedExportIds.includes(report.id);

                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setSelectedReportId(report.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${selected ? 'border-amber-200/40 bg-amber-300/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">{report.title}</p>
                        <p className="text-sm text-slate-300">{report.artist}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">{report.reference}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          event.stopPropagation();
                          setSelectedExportIds((current) => event.target.checked
                            ? [...new Set([...current, report.id])]
                            : current.filter((item) => item !== report.id));
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/10 px-3 py-1">{report.analystStatus}</span>
                      <span className="rounded-full border border-white/10 px-3 py-1">{report.venue?.name || 'Venue pending'}</span>
                      <span className="rounded-full border border-white/10 px-3 py-1">{Math.round((report.matchedTrackConfidence || 0) * 100)}% match</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={!selectedExportIds.length}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} />
                Export {selectedExportIds.length} report{selectedExportIds.length === 1 ? '' : 's'}
              </button>
              {exportUrl && (
                <a href={exportUrl} target="_blank" rel="noreferrer" className="text-sm text-cyan-200 underline-offset-4 hover:underline">
                  Open latest case packet
                </a>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-center gap-3 text-amber-100">
              <TimerReset size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">Repeat Offenders</p>
            </div>
            <div className="mt-5 space-y-3">
              {dashboard?.topRepeatOffenders?.map((item) => (
                <div key={item.venue?.id || item.venue?.name} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{item.venue?.name || 'Unmatched venue'}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.venue?.city || item.venue?.address || 'Location unresolved'}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100">
                      {item.repeatOffenderScore}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{item.reportCount} reports, {item.uniqueSongs} unique songs</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-center gap-3 text-amber-100">
              <FileText size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">Report Detail</p>
            </div>
            {selectedReport ? (
              <>
                <div className="mt-5">
                  <h2 className="text-2xl font-semibold text-white">{selectedReport.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{selectedReport.artist} • {selectedReport.label}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-white/10 px-3 py-1">{selectedReport.rightsType || 'unassigned'}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">{selectedReport.deviceTrustBand} trust</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">{selectedReport.exportStatus}</span>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Venue</p>
                    <p className="mt-3 text-lg font-semibold text-white">{selectedReport.venue?.name || 'Unmatched'}</p>
                    <p className="mt-1 text-sm text-slate-400">{selectedReport.venue?.address || 'Awaiting manual match'}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Submission</p>
                    <p className="mt-3 text-sm text-white">{selectedReport.submission?.reference || selectedReport.reference}</p>
                    <p className="mt-1 text-xs text-slate-400">Duration: {selectedReport.submission?.durationSeconds?.toFixed?.(1) || 'n/a'}s</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">License Assessment</p>
                    <p className="mt-3 text-lg font-semibold text-white">{selectedReport.licenseAssessment?.status || 'unknown'}</p>
                    <p className="mt-1 text-sm text-slate-400">{selectedReport.licenseAssessment?.source || 'No source'}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Estimated Recoverable Value</p>
                    <p className="mt-3 text-lg font-semibold text-white">{formatInr(selectedReport.estimatedRecoverableValueInr)}</p>
                    <p className="mt-1 text-sm text-slate-400">{selectedReport.case?.planningBand || 'Planning band pending'}</p>
                  </div>
                </div>

                {selectedReport.case && (
                  <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Case Ledger</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{selectedReport.case.reference}</p>
                        <p className="mt-1 text-sm text-slate-300">{selectedReport.case.caseStatus} • {selectedReport.case.licenseStatus}</p>
                        <p className="mt-1 text-xs text-slate-400">Evidence count: {selectedReport.case.evidenceCount}</p>
                        <p className="mt-1 text-xs text-slate-400">Primary contributor: {selectedReport.case.contributor?.displayName || 'Unlinked install'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-300">Held rewards: {formatInr(selectedReport.case.rewardSummary?.heldAmountInr)}</p>
                        <p className="mt-1 text-sm text-slate-300">Paid rewards: {formatInr(selectedReport.case.rewardSummary?.paidAmountInr)}</p>
                        <p className="mt-1 text-sm text-slate-300">Realized value: {formatInr(selectedReport.case.realizedValueInr)}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-xs text-slate-400">
                      {(selectedReport.case.rewards || []).map((reward) => (
                        <div key={reward.id} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                          {reward.stage} • {formatInr(reward.amountInr)} • {reward.status}
                        </div>
                      ))}
                    </div>
                    {selectedReport.case.rewardEligible && (
                      <form onSubmit={handleOutcomeSubmit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="text-sm text-slate-300">
                          <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Realized value</span>
                          <input
                            value={outcomeForm.realizedValueInr}
                            onChange={(event) => setOutcomeForm((current) => ({ ...current, realizedValueInr: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
                            placeholder="250000"
                          />
                        </label>
                        <label className="text-sm text-slate-300">
                          <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Signed at</span>
                          <input
                            type="date"
                            value={outcomeForm.settlementSignedAt}
                            onChange={(event) => setOutcomeForm((current) => ({ ...current, settlementSignedAt: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
                          />
                        </label>
                        <button
                          type="submit"
                          className="self-end rounded-full bg-amber-200 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-100"
                        >
                          Record Outcome
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Forensic summary</p>
                  <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{selectedReport.forensicSummary}</pre>
                </div>

                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Source Analysis</p>
                  {sourceAnalysis ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/10 px-3 py-1">{formatSourceClass(sourceAnalysis.sourceClass)}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">{Math.round(Number(sourceAnalysis.confidence || 0) * 100)}% confidence</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">Score {sourceAnalysis.score}/100</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">{sourceAnalysis.modelVersion}</span>
                      </div>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Analyst Source Ground Truth</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                          <span className="rounded-full border border-white/10 px-3 py-1">
                            {sourceReview ? formatSourceClass(sourceReview.reviewedClass) : 'Not reviewed'}
                          </span>
                          {sourceReview && (
                            <span className="rounded-full border border-white/10 px-3 py-1">
                              {sourceReview.isOverride ? 'Overrides model' : 'Matches model'}
                            </span>
                          )}
                          {sourceReview?.reviewedAt && (
                            <span className="rounded-full border border-white/10 px-3 py-1">
                              Reviewed {new Date(sourceReview.reviewedAt).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          Save an analyst source label separately from the final confirm/reject verdict. This is the pre-prod ground-truth path for future calibration.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <label className="text-sm text-slate-300">
                            <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Reviewed source class</span>
                            <select
                              value={sourceReviewForm.reviewedClass}
                              onChange={(event) => setSourceReviewForm((current) => ({ ...current, reviewedClass: event.target.value }))}
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
                            >
                              <option value="">Select source class</option>
                              {sourceReviewOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            disabled={!sourceReviewForm.reviewedClass || sourceReviewSaving}
                            onClick={handleSaveSourceReview}
                            className="self-end rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sourceReviewSaving ? 'Saving...' : 'Save Source Label'}
                          </button>
                        </div>
                        <label className="mt-3 block text-sm text-slate-300">
                          <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Source review notes</span>
                          <textarea
                            value={sourceReviewForm.notes}
                            onChange={(event) => setSourceReviewForm((current) => ({ ...current, notes: event.target.value }))}
                            rows={3}
                            placeholder="Why this source label is correct or why the model is wrong"
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
                          />
                        </label>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {(sourceAnalysis.explanation || []).slice(0, 4).map((note) => (
                          <div key={note} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">
                            {note}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {Object.entries(sourceAnalysis.signals || {}).map(([key, value]) => (
                          <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{key}</p>
                            <p className="mt-2 text-sm font-semibold text-white">{formatSignalValue(value)}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No deterministic source analysis is available for this report yet.</p>
                  )}
                </div>

                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Camera size={16} />
                    <p className="text-xs uppercase tracking-[0.25em]">Peak Frame Analysis</p>
                  </div>
                  {visualAnalysis ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/10 px-3 py-1">{formatPlaybackContext(visualAnalysis.playbackContext)}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">{Math.round(Number(visualAnalysis.confidence || 0) * 100)}% confidence</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">{visualAnalysis.modelVersion || 'visual-v1'}</span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-200">{visualAnalysis.summary || 'Visual evidence analysis is unavailable.'}</p>

                      {!!visualAnalysis.frameObservations?.length && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {visualAnalysis.frameObservations.map((entry) => (
                            <div key={`${entry.timestampSeconds}-${entry.observation}`} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{entry.timestampSeconds}s</p>
                              <p className="mt-2">{entry.observation}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Playback Cues</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {visualCueBuckets.playbackCues.length
                              ? visualCueBuckets.playbackCues.map((item) => (
                                <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white">{item}</span>
                              ))
                              : <span className="text-sm text-slate-400">No clear playback hardware was recognized.</span>}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Venue / Scene Signals</p>
                          <div className="mt-3 space-y-2 text-sm text-slate-200">
                            <p>Scene objects: {visualCueBuckets.sceneObjects.join(', ') || 'None detected'}</p>
                            <p>Venue cues: {(visualAnalysis.venueIdentitySignals || []).join(', ') || 'None detected'}</p>
                            <p>Obstruction flags: {(visualAnalysis.obstructionFlags || []).join(', ') || 'None'}</p>
                          </div>
                        </div>
                      </div>

                      {!!evidencePackage?.visualContext?.frames?.length && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          {evidencePackage.visualContext.frames.map((frame) => (
                            <a
                              key={frame.assetId}
                              href={frame.url}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 transition hover:border-cyan-300/40"
                            >
                              <img src={frame.url} alt={`Peak frame at ${frame.timestampSeconds}s`} className="h-36 w-full object-cover" />
                              <div className="px-3 py-3 text-xs text-slate-300">
                                <p>Peak {frame.peakRank || 'n/a'} at {frame.timestampSeconds ?? 'n/a'}s</p>
                                <p className="mt-1 text-slate-500">Intensity x{frame.relativeIntensity ?? 'n/a'}</p>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No peak-frame visual analysis is available for this report yet.</p>
                  )}
                </div>

                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Evidence Package</p>
                  {evidencePackage ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/10 px-3 py-1">{evidencePackage.packageVersion}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">{evidencePackage.captureIntegrity?.signatureStatus || 'unsigned_or_unverified'}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">Clock skew: {evidencePackage.captureIntegrity?.clockSkewStatus || 'unknown'}</span>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Chain Of Custody</p>
                          <p className="mt-3 text-sm text-white">Hash: {evidencePackage.captureIntegrity?.mediaSha256?.slice?.(0, 18) || 'n/a'}{evidencePackage.captureIntegrity?.mediaSha256 ? '...' : ''}</p>
                          <p className="mt-1 text-sm text-slate-300">Duration: {evidencePackage.captureIntegrity?.durationSeconds ?? 'n/a'}s</p>
                          <p className="mt-1 text-sm text-slate-300">Device: {evidencePackage.captureIntegrity?.device?.model || 'n/a'}</p>
                          <p className="mt-1 text-sm text-slate-300">Consent: {evidencePackage.captureIntegrity?.consentVersion || 'n/a'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Audio Identification</p>
                          <p className="mt-3 text-sm text-white">{evidencePackage.audioIdentification?.matchedSong || 'Pending'}</p>
                          <p className="mt-1 text-sm text-slate-300">ISRC: {evidencePackage.audioIdentification?.isrc || 'n/a'}</p>
                          <p className="mt-1 text-sm text-slate-300">UPC: {evidencePackage.audioIdentification?.upc || 'n/a'}</p>
                          <p className="mt-1 text-sm text-slate-300">Confidence: {evidencePackage.audioIdentification?.matchedTrackConfidence ?? 'n/a'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Venue Context</p>
                          <p className="mt-3 text-sm text-white">{evidencePackage.venueContext?.matchedVenue?.name || 'Unmatched'}</p>
                          <p className="mt-1 text-sm text-slate-300">{evidencePackage.venueContext?.merchant?.legalEntityName || evidencePackage.venueContext?.merchant?.venueName || 'No merchant record'}</p>
                          <p className="mt-1 text-sm text-slate-300">GSTIN: {evidencePackage.venueContext?.merchant?.gstin || 'n/a'}</p>
                          <p className="mt-1 text-sm text-slate-300">30 / 90 day history: {evidencePackage.venueContext?.venueHistory?.reports30Days ?? 0} / {evidencePackage.venueContext?.venueHistory?.reports90Days ?? 0}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Rights Context</p>
                          <p className="mt-3 text-sm text-white">{evidencePackage.rightsAndCaseContext?.org?.name || 'Unassigned rights owner'}</p>
                          <p className="mt-1 text-sm text-slate-300">License: {evidencePackage.rightsAndCaseContext?.licenseAssessment?.status || 'unknown'}</p>
                          <p className="mt-1 text-sm text-slate-300">Case: {evidencePackage.rightsAndCaseContext?.case?.reference || 'No case'}</p>
                          <p className="mt-1 text-sm text-slate-300">Recoverable: {formatInr(evidencePackage.rightsAndCaseContext?.estimatedRecoverableValueInr)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Radio Context</p>
                          <p className="mt-3 text-sm text-white">Wi-Fi: {evidencePackage.radioContext?.wifi?.summary || 'Not captured'}</p>
                          <p className="mt-1 text-sm text-slate-300">Wi-Fi status: {evidencePackage.radioContext?.wifi?.status || 'unavailable'}</p>
                          <p className="mt-1 text-sm text-slate-300">BSSID: {evidencePackage.radioContext?.wifi?.bssid || 'n/a'}</p>
                          <p className="mt-1 text-sm text-slate-300">Bluetooth: {evidencePackage.radioContext?.bluetooth?.summary || 'Not captured'}</p>
                          <p className="mt-1 text-sm text-slate-300">BLE status: {evidencePackage.radioContext?.bluetooth?.status || 'unsupported'}</p>
                          <p className="mt-1 text-sm text-slate-300">Nearby BLE devices: {evidencePackage.radioContext?.bluetooth?.deviceCount ?? 0}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Visual Context</p>
                          <p className="mt-3 text-sm text-white">{formatPlaybackContext(evidencePackage.visualContext?.playbackContext)}</p>
                          <p className="mt-1 text-sm text-slate-300">Confidence: {evidencePackage.visualContext?.confidence != null ? `${Math.round(Number(evidencePackage.visualContext.confidence) * 100)}%` : 'n/a'}</p>
                          <p className="mt-1 text-sm text-slate-300">Peak frames: {evidencePackage.visualContext?.frames?.length ?? 0}</p>
                          <p className="mt-1 text-sm text-slate-300">Playback cues: {evidenceVisualCueBuckets.playbackCues.length}</p>
                          <p className="mt-1 text-sm text-slate-300">Venue cues: {(evidencePackage.visualContext?.venueIdentitySignals || []).length}</p>
                          <p className="mt-1 text-sm text-slate-300">Obstruction flags: {(evidencePackage.visualContext?.obstructionFlags || []).length}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Evidence package sections are not available for this report yet.</p>
                  )}
                </div>

                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  rows={4}
                  placeholder="Analyst notes"
                  className="mt-5 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
                />

                <div className="mt-5 flex flex-wrap gap-3">
                  {verdictButtons.map((button) => (
                    <button
                      key={button.verdict}
                      type="button"
                      onClick={() => handleReview(button.verdict)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${button.className}`}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-5 text-sm text-slate-400">No report selected.</p>
            )}
          </div>

          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-center gap-3 text-amber-100">
              <MapPinned size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">Venue Profile</p>
            </div>
            {selectedVenue?.venue ? (
              <>
                <h3 className="mt-5 text-2xl font-semibold text-white">{selectedVenue.venue.name}</h3>
                <p className="mt-2 text-sm text-slate-400">{selectedVenue.venue.address}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Reports</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{selectedVenue.metrics.totalReports}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Repeat Score</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{selectedVenue.metrics.repeatOffenderScore}</p>
                  </div>
                </div>
                {selectedVenue.merchant && (
                  <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Merchant Master</p>
                    <p className="mt-3 text-white">{selectedVenue.merchant.legalEntityName || selectedVenue.merchant.venueName}</p>
                    <p className="mt-1 text-slate-400">GSTIN: {selectedVenue.merchant.gstin || 'unavailable'}</p>
                    <p className="mt-1 text-slate-400">{selectedVenue.merchant.venueType} • {selectedVenue.merchant.cityTier}</p>
                  </div>
                )}
                <div className="mt-5 space-y-3">
                  {(selectedVenue.coverage || []).map((coverage) => (
                    <div key={coverage.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                      <p className="font-semibold text-white">{coverage.coverageType}</p>
                      <p className="mt-1 text-slate-400">Valid from {coverage.validFrom} to {coverage.validTo || 'open-ended'}</p>
                    </div>
                  ))}
                  {(selectedVenue.licenseStatuses || []).map((license) => (
                    <div key={license.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                      <p className="font-semibold text-white">{license.status}</p>
                      <p className="mt-1 text-slate-400">{license.evidenceSource || 'admin-import'}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-5 text-sm text-slate-400">Venue metrics will appear when a report with a matched venue is selected.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

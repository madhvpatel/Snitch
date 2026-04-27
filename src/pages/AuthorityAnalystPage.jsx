import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeInfo,
  Building2,
  FileSearch,
  Landmark,
  LogOut,
  MapPinned,
  ShieldCheck,
  Video,
  Image as ImageIcon,
  PlaySquare,
  AlertTriangle,
  Send,
  X,
  ExternalLink
} from 'lucide-react';

import {
  PORTAL_TOKEN_STORAGE_KEY,
  getDemoAccounts,
  getPortalReports,
  getPortalSession,
  loginPortal,
} from '../services/platformApi';
import { AuthorityVenueMap } from '../components/platform/AuthorityVenueMap';
import {
  buildCityStats,
  buildIprsCaseSummary,
  buildVenueStats,
  normalizeReport,
} from './AuthorityPage';

const DEFAULT_LOGIN_FORM = {
  email: 'admin@snitch.local',
  password: 'snitch-demo-2026',
  totpCode: '',
};

const sortDemoAccounts = (accounts) => accounts
  .slice()
  .sort((left, right) => Number(Boolean(right.email === 'admin@snitch.local')) - Number(Boolean(left.email === 'admin@snitch.local')));

const loadSavedToken = () => window.localStorage.getItem(PORTAL_TOKEN_STORAGE_KEY) || '';
const compactNumber = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

const cx = (...values) => values.filter(Boolean).join(' ');

const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

const formatInr = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const resolveAssetUrl = (value) => {
  if (!value || typeof value !== 'string' || typeof window === 'undefined') {
    return value || null;
  }
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname.startsWith('/media/')) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    return value;
  }
};

const STAGE_COPY = {
  actionable: {
    label: 'Strong Case',
    tone: 'border-[#92a16d]/35 bg-[#92a16d]/18 text-[#d9e7bf]',
    summary: 'Clear infringing music detected with visual proof.',
  },
  provisional: {
    label: 'Needs More Proof',
    tone: 'border-[#d7b667]/35 bg-[#d7b667]/16 text-[#f0dab2]',
    summary: 'We captured something, but waiting for a clearer recording.',
  },
  rejected: {
    label: 'Ignore / Parked',
    tone: 'border-[#ad5242]/35 bg-[#ad5242]/18 text-[#ebb8b0]',
    summary: 'False alarm or low-quality recording.',
  },
};

const PRIORITY_COPY = {
  immediate_action: {
    label: 'Send Legal Notice',
    tone: 'border-[#92a16d]/35 bg-[#92a16d]/18 text-[#d9e7bf]',
    summary: 'This venue has enough clear recordings to issue a formal notice.',
    buttonText: 'Draft Legal Notice',
    icon: Send
  },
  watchlist: {
    label: 'Monitor Venue',
    tone: 'border-[#d7b667]/35 bg-[#d7b667]/16 text-[#f0dab2]',
    summary: 'We know they are playing music, but we need a few more recordings before acting.',
    buttonText: 'Assign Field Agent',
    icon: PlaySquare
  },
  parked: {
    label: 'No Action Needed',
    tone: 'border-[#6d7f86]/35 bg-[#6d7f86]/18 text-[#d7dfe2]',
    summary: 'Not enough data to worry about this venue right now.',
    buttonText: 'Ignore Venue',
    icon: ShieldCheck
  },
};

const getPriorityCopy = (priorityBand) => PRIORITY_COPY[priorityBand] || PRIORITY_COPY.parked;

const StatCard = ({ icon, label, value, helper }) => {
  const IconElement = icon;
  return (
    <div className="authority-panel rounded-[24px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="authority-label text-[10px] text-[#9e9278]">{label}</p>
          <p className="authority-data mt-4 text-3xl text-[#f5ecd7]">{value}</p>
        </div>
        <div className="rounded-full border border-[#4d4332] bg-[#0c0a08] p-2 text-[#d7b667]">
          <IconElement className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#c7bca6]">{helper}</p>
    </div>
  );
};

const SectionHeader = ({ eyebrow, title, helper, action }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      {eyebrow && <p className="authority-label text-[10px] text-[#9e9278]">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-semibold text-[#f5ecd7]">{title}</h2>
      {helper && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c8bea9]">{helper}</p>}
    </div>
    {action}
  </div>
);

const ToneBadge = ({ toneClass, children }) => (
  <span className={cx('inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em]', toneClass)}>
    {children}
  </span>
);

const VenueCard = ({ venue, active, onSelect }) => {
  const priority = getPriorityCopy(venue.priorityBand);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        'authority-panel w-full rounded-[24px] p-4 text-left transition',
        active ? 'border-[#d7b667]/55 shadow-[0_0_0_1px_rgba(215,182,103,0.2)] bg-[#1a150e]' : 'hover:border-[#6a5d45] hover:bg-[#14100b]',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-[#f5ecd7]">{venue.venueName}</p>
          <p className="mt-1 text-sm text-[#c9bea8]">{venue.city}</p>
        </div>
        <ToneBadge toneClass={priority.tone}>{priority.label}</ToneBadge>
      </div>

      <p className="mt-4 text-sm leading-6 text-[#cdc2ad]">
        We captured <span className="font-bold text-[#f5ecd7]">{venue.reportCount}</span> recordings here. 
        Estimated target value: <span className="font-bold text-[#f5ecd7]">{formatInr(venue.estimatedRecoverableValueInr)}</span>.
      </p>
    </button>
  );
};

const gatherMediaForVenue = (venue) => {
  if (!venue || !venue.reports) return { videos: [], audio: [], frames: [] };
  const media = { videos: [], audio: [], frames: [] };

  venue.reports.forEach((report) => {
    const rawVideoUrl = resolveAssetUrl(report.capture?.assets?.rawVideo?.url);
    if (rawVideoUrl) media.videos.push(rawVideoUrl);

    const audioUrl = resolveAssetUrl(report.capture?.assets?.derivedAudio?.url);
    if (audioUrl) media.audio.push(audioUrl);

    if (report.visual?.frames) {
      report.visual.frames.forEach(f => {
        const frameUrl = resolveAssetUrl(f.url);
        if (frameUrl) media.frames.push(frameUrl);
      });
    }
  });

  return media;
};

export const AuthorityAnalystPage = () => {
  const [token, setToken] = useState(loadSavedToken);
  const [me, setMe] = useState(null);
  const [reports, setReports] = useState([]);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [selectedVenueKey, setSelectedVenueKey] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loginForm, setLoginForm] = useState(DEFAULT_LOGIN_FORM);
  const [error, setError] = useState(null);

  const loadAnalystData = useCallback(async (sessionToken) => {
    const [session, reportsPayload] = await Promise.all([
      getPortalSession(sessionToken),
      getPortalReports(sessionToken),
    ]);
    setMe(session.user);
    setReports(reportsPayload.reports || []);
  }, []);

  const loadDemoAccess = useCallback(async () => {
    try {
      const payload = await getDemoAccounts();
      const sortedAccounts = sortDemoAccounts(payload.accounts || []);
      setDemoAccounts(sortedAccounts);
      return sortedAccounts;
    } catch {
      setDemoAccounts([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (token) return;
    const timeoutId = window.setTimeout(() => { void loadDemoAccess(); }, 0);
    const intervalId = window.setInterval(() => { void loadDemoAccess(); }, 15000);
    return () => { window.clearTimeout(timeoutId); window.clearInterval(intervalId); };
  }, [loadDemoAccess, token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        await loadAnalystData(token);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
        window.localStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
        setToken('');
      }
    };
    load();
    return () => { active = false; };
  }, [loadAnalystData, token]);

  const normalizedReports = useMemo(
    () => reports.map(normalizeReport).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)),
    [reports],
  );

  const venueStats = useMemo(() => buildVenueStats(normalizedReports), [normalizedReports]);
  
  const selectedVenue = useMemo(() => {
    if (selectedVenueKey) return venueStats.find((v) => v.key === selectedVenueKey) || null;
    if (venueStats.length > 0) return venueStats[0];
    return null;
  }, [selectedVenueKey, venueStats]);

  const topVenues = venueStats.slice(0, 10);
  const recoverableValue = sum(normalizedReports.map((r) => r.estimatedRecoverableValueInr));
  const actionableVenuesCount = venueStats.filter(v => v.priorityBand === 'immediate_action').length;
  const ActionIcon = selectedVenue ? getPriorityCopy(selectedVenue.priorityBand).icon : undefined;

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      const session = await loginPortal(loginForm);
      window.localStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, session.token);
      setToken(session.token);
    } catch (loginError) { setError(loginError.message); }
  };

  const handleUseDemoAccount = useCallback(async (account) => {
    setError(null);
    const latestAccounts = await loadDemoAccess();
    const latestAccount = latestAccounts.find((entry) => entry.email === account.email) || account;
    setLoginForm({ email: latestAccount.email, password: 'snitch-demo-2026', totpCode: latestAccount.currentTotpCode || '' });
  }, [loadDemoAccess]);

  const handleLogout = () => {
    window.localStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
    setToken(''); setMe(null); setReports([]); setSelectedVenueKey(''); setError(null);
  };

  if (!token) {
    return (
      <div className="authority-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="authority-panel authority-grid-bg rounded-[32px] p-6 sm:p-8">
            <p className="authority-label text-[10px] text-[#9e9278]">Authority Dashboard</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold uppercase tracking-[0.06em] text-[#f5ecd7] sm:text-5xl">
              Venue enforcement simplified.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#c4b9a2]">
              Log in to see which venues are playing copyrighted music and what you should do about it. No technical jargon, just places and actions.
            </p>

            <form onSubmit={handleLogin} className="mt-8 grid gap-4 rounded-[28px] border border-[#4a4232] bg-[#15110c]/92 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-[#d2c8b2]">
                  <span className="authority-label mb-2 block text-[10px] text-[#8f846d]">Account</span>
                  <input
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="w-full rounded-2xl border border-[#4f4533] bg-[#0d0b08] px-4 py-3 text-[#f5ecd7] outline-none"
                    placeholder="admin@snitch.local"
                  />
                </label>
                <label className="text-sm text-[#d2c8b2]">
                  <span className="authority-label mb-2 block text-[10px] text-[#8f846d]">Password</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full rounded-2xl border border-[#4f4533] bg-[#0d0b08] px-4 py-3 text-[#f5ecd7] outline-none"
                  />
                </label>
              </div>
              {error && <div className="rounded-2xl border border-[#ad5242]/40 bg-[#ad5242]/12 px-4 py-3 text-sm text-[#efc4bc]">{error}</div>}
              <button type="submit" className="mt-2 w-full rounded-full bg-[#d7b667] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#1a150e] transition hover:bg-[#ebd296]">
                Login
              </button>
            </form>
          </section>

          <aside className="authority-panel rounded-[32px] p-6">
            <SectionHeader eyebrow="Demo Entry" title="Demo Accounts" helper="Click to autofill an analyst account." />
            <div className="mt-6 space-y-4">
              {demoAccounts.map((account) => (
                <div key={account.email} className="rounded-[24px] border border-[#4a4232] bg-[#18130f] p-4 cursor-pointer hover:border-[#d7b667]/45" onClick={() => handleUseDemoAccount(account)}>
                  <p className="text-sm font-medium text-[#f5ecd7]">{account.org} • <span className="uppercase text-[#8f846d]">{account.role}</span></p>
                  <p className="mt-1 text-sm text-[#c7bca6]">{account.email}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const selectedMedia = gatherMediaForVenue(selectedVenue);

  return (
    <div className="authority-shell min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="authority-panel authority-grid-bg rounded-[30px] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-4xl">
              <p className="authority-label text-[10px] text-[#948973]">Venue Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold uppercase tracking-[0.05em] text-[#f5ecd7] sm:text-4xl">
                Venues under review
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#c7bca6]">
                A simplified list of venues mapped by infringing activity. See which ones need legal action now.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleLogout} className="rounded-full border border-[#4d4332] bg-[#0d0b08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#f5ecd7] hover:border-[#ad5242]/45 hover:text-[#efc4bc]">
                Log out
              </button>
            </div>
          </div>
        </header>

        {error && <div className="authority-panel rounded-[24px] border-[#ad5242]/35 bg-[#1c100e] p-4 text-sm text-[#efc4bc]">{error}</div>}

        {!normalizedReports.length ? (
          <div className="authority-panel rounded-[28px] p-8 text-center text-[#f5ecd7]">No venues found for your region.</div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <StatCard icon={Building2} label="Flagged Venues" value={venueStats.length} helper="Places with at least one report." />
              <StatCard icon={AlertTriangle} label="Actionable Now" value={actionableVenuesCount} helper="Places ready for legal notice." />
              <StatCard icon={Landmark} label="Total Value" value={formatInr(recoverableValue)} helper="Estimated recoverable revenue." />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5">
                <div className="authority-panel rounded-[28px] p-5">
                  <SectionHeader eyebrow="Venue Shortlist" title="Places to review" helper="Venues sorted by action priority." />
                  <div className="mt-5 space-y-4">
                    {topVenues.map((venue) => (
                      <VenueCard key={venue.key} venue={venue} active={selectedVenue?.key === venue.key} onSelect={() => {
                        setSelectedVenueKey(venue.key);
                        setIsDrawerOpen(true);
                      }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
                <div className="authority-panel rounded-[28px] overflow-hidden">
                   <AuthorityVenueMap venues={venueStats} selectedVenueKey={selectedVenue?.key || ''} onSelectVenue={(key) => {
                     setSelectedVenueKey(key);
                     setIsDrawerOpen(true);
                   }} />
                </div>
                
                {selectedVenue && (
                  <div className="authority-panel rounded-[28px] p-5">
                    <SectionHeader 
                      eyebrow="Venue Intel" 
                      title={selectedVenue.venueName} 
                      helper={selectedVenue.city} 
                      action={<ToneBadge toneClass={getPriorityCopy(selectedVenue.priorityBand).tone}>{getPriorityCopy(selectedVenue.priorityBand).label}</ToneBadge>}
                    />
                    
                    <div className="mt-5 rounded-[20px] border border-[#4a4232] bg-[#14100c] p-6 text-center">
                      <p className="text-[#c3b8a2] text-sm">Recommended Action</p>
                      <h3 className="text-2xl font-semibold text-[#f5ecd7] mt-2 mb-4">{getPriorityCopy(selectedVenue.priorityBand).summary}</h3>
                      <button className="inline-flex items-center gap-2 rounded-full bg-[#d7b667] px-6 py-3 font-semibold uppercase tracking-[0.1em] text-[#1a150e] hover:bg-[#ebd296] transition">
                         {ActionIcon && <ActionIcon className="h-5 w-5" />}
                         {getPriorityCopy(selectedVenue.priorityBand).buttonText}
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                       <div className="rounded-[18px] border border-[#4a4232] bg-[#16110d] px-4 py-4">
                          <p className="text-sm font-medium text-[#f5ecd7] flex items-center gap-2"><Video className="w-4 h-4 text-[#d7b667]"/> Recordings</p>
                          <p className="mt-2 text-3xl text-[#f5ecd7]">{selectedMedia.videos.length}</p>
                          <p className="mt-1 text-xs text-[#a2957b]">Video clips captured</p>
                       </div>
                       <div className="rounded-[18px] border border-[#4a4232] bg-[#16110d] px-4 py-4">
                          <p className="text-sm font-medium text-[#f5ecd7] flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#d7b667]"/> Images</p>
                          <p className="mt-2 text-3xl text-[#f5ecd7]">{selectedMedia.frames.length}</p>
                          <p className="mt-1 text-xs text-[#a2957b]">Clear frames identified</p>
                       </div>
                    </div>

                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {isDrawerOpen && selectedVenue && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-[#110e0a] h-full shadow-2xl flex flex-col border-l border-[#4a4232] transform transition-transform translate-x-0">
            <div className="p-5 flex items-center justify-between border-b border-[#4a4232]">
              <h2 className="text-xl font-semibold text-[#f5ecd7]">All Evidences</h2>
              <button type="button" onClick={() => setIsDrawerOpen(false)} className="p-2 rounded-full hover:bg-[#1a150e] text-[#a2957b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {selectedVenue.reports.map((report) => (
                <div key={report.id} className="rounded-[18px] border border-[#4a4232] bg-[#16110d] p-4 text-[#cfc4af]">
                  <p className="text-[#f5ecd7] font-semibold">{report.title || 'Unknown Track'}</p>
                  <p className="text-sm text-[#c9bea8]">{report.artist}</p>
                  <p className="text-xs text-[#a2957b] mt-2">{formatRelativeTime(report.createdAt)}</p>
                  <div className="mt-3 flex gap-3">
                    {resolveAssetUrl(report.capture?.assets?.derivedAudio?.url) && (
                      <a href={resolveAssetUrl(report.capture.assets.derivedAudio.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#d7b667] hover:underline">
                        Audio
                      </a>
                    )}
                    {resolveAssetUrl(report.capture?.assets?.rawVideo?.url) && (
                      <a href={resolveAssetUrl(report.capture.assets.rawVideo.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#d7b667] hover:underline">
                        Video
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-[#4a4232]">
              <Link to="/authority" className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1a150e] border border-[#4a4232] px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#d7b667] hover:bg-[#261e16] transition">
                Deeper Analysis <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

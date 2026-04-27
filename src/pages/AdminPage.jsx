import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Cpu, Database, LogOut, Shield, Upload } from 'lucide-react';

import {
  PORTAL_TOKEN_STORAGE_KEY,
  getAdminAbuseQueue,
  getAdminDependencyHealth,
  getAdminRewardsOverview,
  getDemoAccounts,
  getPortalSession,
  importAdminCsv,
  loginPortal,
} from '../services/platformApi';

const sampleCatalogCsv = `org_slug,title,artist,isrc,active_from
saregama-demo,Test Song,The Fixtures,IN-SN1-24-00001,2024-01-01`;

const sampleRightsCsv = `slug,type,name,pro_code
iprs-demo,collective,IPRS Demo,IPRS`;

const sampleCoverageCsv = `org_slug,venue_name,address,city,coverage_type,valid_from
iprs-demo,Demo Club,Connaught Place,New Delhi,performance,2025-01-01`;

const sampleMerchantCsv = `venue_name,address,city,legal_entity_name,gstin,city_tier,venue_type,hotel_star_class,outlet_count,event_capability,rights_layers
Demo Club,Connaught Place,New Delhi,Demo Hospitality LLP,07ABCDE1234F1Z5,tier_1,restaurant_bar_lounge,,1,standard,label|collective`;

const sampleLicenseCsv = `org_slug,venue_name,address,status,evidence_source,last_verified_at
iprs-demo,Demo Club,Connaught Place,unlicensed,field-verification,2026-03-01`;

const sampleTariffCsv = `org_slug,rights_layer,venue_type,city_tier,basis,minimum_fee_inr,source_url,effective_from
iprs-demo,collective,restaurant_bar_lounge,tier_1,annual,180000,https://www.iprs.org/wp-content/uploads/TARIFF-RB.pdf,2025-01-01`;

const formatInr = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

export const AdminPage = () => {
  const [token, setToken] = useState(() => window.localStorage.getItem(PORTAL_TOKEN_STORAGE_KEY) || '');
  const [me, setMe] = useState(null);
  const [health, setHealth] = useState(null);
  const [abuseQueue, setAbuseQueue] = useState(null);
  const [rewardsOverview, setRewardsOverview] = useState(null);
  const [error, setError] = useState(null);
  const [loginForm, setLoginForm] = useState({
    email: 'admin@snitch.local',
    password: 'snitch-demo-2026',
    totpCode: '',
  });
  const [catalogCsv, setCatalogCsv] = useState(sampleCatalogCsv);
  const [rightsCsv, setRightsCsv] = useState(sampleRightsCsv);
  const [coverageCsv, setCoverageCsv] = useState(sampleCoverageCsv);
  const [merchantCsv, setMerchantCsv] = useState(sampleMerchantCsv);
  const [licenseCsv, setLicenseCsv] = useState(sampleLicenseCsv);
  const [tariffCsv, setTariffCsv] = useState(sampleTariffCsv);
  const [importMessage, setImportMessage] = useState(null);
  const [demoAccounts, setDemoAccounts] = useState([]);

  const loadAdminData = useCallback(async (sessionToken) => {
    const session = await getPortalSession(sessionToken);

    if (!session.user.isPlatformAdmin) {
      throw new Error('Platform admin access required');
    }

    const [dependencyHealth, queue, rewardsPayload] = await Promise.all([
      getAdminDependencyHealth(sessionToken),
      getAdminAbuseQueue(sessionToken),
      getAdminRewardsOverview(sessionToken),
    ]);

    setMe(session.user);
    setHealth(dependencyHealth);
    setAbuseQueue(queue);
    setRewardsOverview(rewardsPayload);
  }, []);

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
        await loadAdminData(token);
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
  }, [loadAdminData, token]);

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
    setHealth(null);
    setAbuseQueue(null);
    setRewardsOverview(null);
  };

  const handleImport = async (path, csv, label) => {
    if (!token) {
      return;
    }

    try {
      const payload = await importAdminCsv(token, path, csv);
      setImportMessage(`${label}: imported ${payload.imported}`);
      await loadAdminData(token);
    } catch (importError) {
      setError(importError.message);
    }
  };

  if (!token) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">Platform Admin</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Dependency health and workspace control.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Platform admins manage imports, inspect abuse, and monitor whether the recorder pipeline dependencies are ready.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Email</span>
                <input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Password</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
                />
              </label>
            </div>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">TOTP code</span>
              <input
                value={loginForm.totpCode}
                onChange={(event) => setLoginForm((current) => ({ ...current, totpCode: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
              />
            </label>
            {error && <p className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
            <button type="submit" className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
              Sign in to Admin
            </button>
          </form>
        </section>

        <aside className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex items-center gap-3 text-emerald-100">
            <Shield size={18} />
            <p className="text-xs font-semibold uppercase tracking-[0.3em]">Local Seed</p>
          </div>
          {demoAccounts
            .filter((account) => account.email === 'admin@snitch.local')
            .map((account) => (
              <div key={account.email} className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
                <p className="font-semibold text-white">{account.email}</p>
                <p className="mt-2 text-slate-400">Password: <span className="font-mono text-slate-200">snitch-demo-2026</span></p>
                <p className="mt-2 break-all font-mono text-xs text-slate-300">TOTP secret: {account.totpSecret}</p>
                <p className="mt-2 font-mono text-sm text-emerald-100">Current code: {account.currentTotpCode || 'Unavailable'}</p>
                <button
                  type="button"
                  onClick={() => setLoginForm({
                    email: account.email,
                    password: 'snitch-demo-2026',
                    totpCode: account.currentTotpCode || '',
                  })}
                  className="mt-3 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/15"
                >
                  Use Admin Account
                </button>
              </div>
            ))}
        </aside>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">Platform Admin</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{me?.org?.name || 'Snitch Platform'}</h1>
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
      </section>

      {error && <div className="rounded-3xl border border-rose-300/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">{error}</div>}
      {importMessage && <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">{importMessage}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-center gap-3 text-emerald-100">
              <Shield size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">Rewards Program</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Actionable Cases</p>
                <p className="mt-3 text-3xl font-semibold text-white">{rewardsOverview?.summary?.actionableCases || 0}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Recoverable Value</p>
                <p className="mt-3 text-3xl font-semibold text-white">{formatInr(rewardsOverview?.summary?.totalEstimatedRecoverableValueInr)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Held Rewards</p>
                <p className="mt-3 text-3xl font-semibold text-white">{formatInr(rewardsOverview?.summary?.heldRewardsInr)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Realized Value</p>
                <p className="mt-3 text-3xl font-semibold text-white">{formatInr(rewardsOverview?.summary?.totalRealizedValueInr)}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Contributors</p>
                <p className="mt-3 text-xl font-semibold text-white">{rewardsOverview?.summary?.contributors || 0}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Duplicate Rate</p>
                <p className="mt-3 text-xl font-semibold text-white">{Math.round((rewardsOverview?.summary?.duplicateRate || 0) * 100)}%</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Unlicensed Hit Rate</p>
                <p className="mt-3 text-xl font-semibold text-white">{Math.round((rewardsOverview?.summary?.unlicensedHitRate || 0) * 100)}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-center gap-3 text-emerald-100">
              <Cpu size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">Dependency Health</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.entries(health?.services || {}).map(([key, service]) => (
                <div key={key} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{key}</p>
                  <p className="mt-3 text-lg font-semibold text-white">{service.available === false ? 'Unavailable' : service.configured ? 'Ready' : 'Missing config'}</p>
                  <p className="mt-2 text-xs text-slate-400">{service.version || service.mode || service.error || 'No extra detail'}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-center gap-3 text-emerald-100">
              <AlertTriangle size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">Abuse Queue</p>
            </div>
            <div className="mt-5 space-y-3">
              {(abuseQueue?.installs || []).map((install) => (
                <div key={install.installId} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="break-all font-mono text-xs text-slate-200">{install.installId}</p>
                  <p className="mt-2 text-sm text-white">Abuse score: {install.abuseScore}</p>
                  <p className="text-xs text-slate-400">Submissions: {install.submissionCount}</p>
                </div>
              ))}
              {!abuseQueue?.installs?.length && (
                <p className="text-sm text-slate-400">No installs are currently over the review threshold.</p>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-center gap-3 text-emerald-100">
              <Database size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">Contributor Network</p>
            </div>
            <div className="mt-5 space-y-3">
              {(rewardsOverview?.contributors || []).map((contributor) => (
                <div key={contributor.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{contributor.displayName}</p>
                  <p className="mt-1 text-sm text-slate-300">{contributor.trustTierLabel} • {contributor.city || 'City pending'}</p>
                  <p className="mt-1 text-xs text-slate-400">Monthly cap: {formatInr(contributor.monthlyPayoutCapInr)}</p>
                  <p className="mt-1 text-xs text-slate-400">Current month rewards: {formatInr(contributor.currentMonthRewardsInr)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex items-center gap-3 text-emerald-100">
            <Database size={16} />
            <p className="text-xs font-semibold uppercase tracking-[0.3em]">Imports</p>
          </div>

          <div className="mt-5 space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Catalog import</p>
              <textarea value={catalogCsv} onChange={(event) => setCatalogCsv(event.target.value)} rows={5} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" onClick={() => handleImport('/api/admin/catalog/import', catalogCsv, 'Catalog import')} className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
                <Upload size={16} />
                Import catalog
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Rights-owner import</p>
              <textarea value={rightsCsv} onChange={(event) => setRightsCsv(event.target.value)} rows={5} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" onClick={() => handleImport('/api/admin/rights/import', rightsCsv, 'Rights import')} className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
                <Upload size={16} />
                Import rights orgs
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Venue coverage import</p>
              <textarea value={coverageCsv} onChange={(event) => setCoverageCsv(event.target.value)} rows={5} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" onClick={() => handleImport('/api/admin/venue-coverage/import', coverageCsv, 'Coverage import')} className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
                <Upload size={16} />
                Import coverage
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Merchant master import</p>
              <textarea value={merchantCsv} onChange={(event) => setMerchantCsv(event.target.value)} rows={5} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" onClick={() => handleImport('/api/admin/merchant-master/import', merchantCsv, 'Merchant import')} className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
                <Upload size={16} />
                Import merchants
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">License status import</p>
              <textarea value={licenseCsv} onChange={(event) => setLicenseCsv(event.target.value)} rows={5} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" onClick={() => handleImport('/api/admin/license-status/import', licenseCsv, 'License import')} className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
                <Upload size={16} />
                Import license status
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Tariff table import</p>
              <textarea value={tariffCsv} onChange={(event) => setTariffCsv(event.target.value)} rows={5} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" onClick={() => handleImport('/api/admin/tariffs/import', tariffCsv, 'Tariff import')} className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
                <Upload size={16} />
                Import tariffs
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

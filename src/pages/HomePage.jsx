import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, FileSearch, MapPinned, RadioTower, ShieldAlert } from 'lucide-react';

import { SystemStatus } from '../components/SystemStatus';
import { getSystemHealth } from '../services/api';

const cards = [
  {
    title: 'Public Recorder',
    description: 'Anonymous mobile-web capture with live video, location evidence, time sync, and signed finalize.',
    to: '/capture',
    icon: RadioTower,
    accent: 'from-cyan-400/30 to-sky-400/10',
  },
  {
    title: 'Rights Holder Portal',
    description: 'Org-scoped queue for labels and collecting societies with venue metrics, reviews, and exports.',
    to: '/portal',
    icon: Building2,
    accent: 'from-amber-400/30 to-orange-400/10',
  },
  {
    title: 'Authority Console',
    description: 'Coordinate-led dashboard for authorities with geo clusters, evidence quality, and case-packet triage.',
    to: '/authority',
    icon: MapPinned,
    accent: 'from-sky-400/30 to-cyan-400/10',
  },
  {
    title: 'Platform Admin',
    description: 'Dependency health, abuse review, org imports, and cross-workspace oversight for your internal team.',
    to: '/admin',
    icon: ShieldAlert,
    accent: 'from-emerald-400/30 to-green-400/10',
  },
];

export const HomePage = () => {
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      const result = await getSystemHealth();
      if (active) {
        setHealth(result);
        setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/70">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(245,158,11,0.08))] px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">Recorder + Enforcement</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Turn venue recordings into reviewable enforcement evidence.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Snitch v1 is structured around one live capture surface plus dedicated rights-holder, authority, and
              platform workspaces. Recorder clips are constrained to 15–20 seconds, signed by a privacy-safe install
              identity, then processed into evidence-rich reports.
            </p>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-4 sm:px-8">
            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/8 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-100">Evidence Chain</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Start/end server time sync, SHA-256 media hash, geolocation snapshots, and signed recorder payloads.
              </p>
            </div>
            <div className="rounded-3xl border border-amber-300/20 bg-amber-400/8 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-100">Org Visibility</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Labels see catalog-linked reports. Collectives see administered rights and venue coverage views.
              </p>
            </div>
            <div className="rounded-3xl border border-sky-300/20 bg-sky-400/8 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-sky-100">Authority Triage</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Authorities get coordinate clusters, quality bands, unresolved track counts, and evidence-package detail.
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/8 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-100">Repeat Offenders</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Dashboard metrics prioritize repeat venues while keeping raw report counts as the headline signal.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex items-center gap-3 text-cyan-200">
            <FileSearch size={18} />
            <p className="text-xs font-semibold uppercase tracking-[0.3em]">v1 Operating Rules</p>
          </div>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
            <li>Recorder flow is mobile-web only. Gallery uploads are not valid evidence in production routes.</li>
            <li>Wi-Fi and Bluetooth scanning stay out of v1 because browser capture surfaces cannot provide them reliably.</li>
            <li>Every finalized submission becomes a report. Deduping is secondary analyst metadata, not a count override.</li>
            <li>Portal auth is local JWT + TOTP in this build so you can exercise the whole stack before managed auth lands.</li>
          </ul>
        </div>
      </section>

      <SystemStatus
        health={health}
        isLoading={isLoading}
        onRefresh={async () => {
          setIsLoading(true);
          setHealth(await getSystemHealth());
          setIsLoading(false);
        }}
      />

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, description, to, icon, accent }) => (
          <Link
            key={title}
            to={to}
            className={`group rounded-[28px] border border-white/10 bg-gradient-to-br ${accent} p-[1px]`}
          >
            <div className="h-full rounded-[27px] bg-slate-950/90 p-6 transition group-hover:bg-slate-900/95">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">
                  {React.createElement(icon, { size: 22 })}
                </div>
                <ArrowRight size={18} className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-200" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
};

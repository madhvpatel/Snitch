import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, FileSearch, RadioTower, Shield, Sparkles } from 'lucide-react';

const shellConfig = {
  home: {
    badge: 'Snitch India v1',
    description: 'Recorder, rights-holder, authority, and platform surfaces are separated into their own pages.',
    background: 'bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(180deg,_#09111f_0%,_#05080f_100%)]',
    accent: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
    icon: Sparkles,
  },
  recorder: {
    badge: 'Snitch Recorder',
    description: 'Public-facing live capture only.',
    background: 'bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),linear-gradient(180deg,_#05131c_0%,_#04070d_100%)]',
    accent: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
    icon: RadioTower,
  },
  portal: {
    badge: 'Rights Holder Portal',
    description: 'PRO and label workspace only.',
    background: 'bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_28%),linear-gradient(180deg,_#1a1104_0%,_#080507_100%)]',
    accent: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
    icon: Building2,
  },
  authority: {
    badge: 'Authority Console',
    description: 'Coordinate-led evidence dashboard for outside authorities.',
    background: 'bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_28%),linear-gradient(180deg,_#07111d_0%,_#04070d_100%)]',
    accent: 'border-sky-300/30 bg-sky-300/10 text-sky-100',
    icon: FileSearch,
  },
  admin: {
    badge: 'Platform Admin',
    description: 'Internal oversight and operations only.',
    background: 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_#06140d_0%,_#040708_100%)]',
    accent: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
    icon: Shield,
  },
};

export const RouteShell = ({ children, variant = 'home' }) => {
  const config = shellConfig[variant] || shellConfig.home;
  const Icon = config.icon;

  return (
    <div className={`min-h-screen text-slate-100 ${config.background}`}>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[28px] border border-white/10 bg-slate-950/70 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold tracking-[0.2em] uppercase ${config.accent}`}>
                <Icon size={16} />
                {config.badge}
              </div>
              <p className="hidden text-sm text-slate-400 md:block">
                {config.description}
              </p>
            </div>

            {variant !== 'home' && (
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
              >
                <ArrowLeft size={16} />
                Surface Chooser
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

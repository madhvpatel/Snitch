import React from 'react';
import { Activity, Bot, Cpu, RefreshCcw, Server, Wrench } from 'lucide-react';

const toneClass = {
    ready: 'border-green-500/40 bg-green-500/10 text-green-300',
    warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
    offline: 'border-red-500/40 bg-red-500/10 text-red-300',
    unknown: 'border-gray-700 bg-gray-800/70 text-gray-400'
};

const StatusPill = ({ label, value, tone }) => (
    <div className={`rounded-xl border px-4 py-3 ${toneClass[tone] || toneClass.unknown}`}>
        <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">{label}</p>
        <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
);

export const SystemStatus = ({ health, isLoading, onRefresh }) => {
    const apiReady = health?.api?.reachable;
    const pythonReady = health?.pythonAi?.reachable && health?.pythonAi?.model_loaded;
    const ffmpegReady = Boolean(health?.api?.services?.ffmpeg?.available);
    const acrcloudReady = Boolean(health?.api?.services?.acrcloud?.configured);
    const geminiReady = Boolean(health?.api?.services?.gemini?.configured);

    const items = [
        {
            icon: <Server size={16} />,
            label: 'Node API',
            value: apiReady ? 'Reachable' : 'Offline',
            tone: apiReady ? 'ready' : health ? 'offline' : 'unknown'
        },
        {
            icon: <Cpu size={16} />,
            label: 'Demucs',
            value: pythonReady ? `${health.pythonAi.device?.toUpperCase() || 'READY'} Ready` : (health?.pythonAi?.reachable ? 'Model not loaded' : 'Offline'),
            tone: pythonReady ? 'ready' : health?.pythonAi?.reachable ? 'warning' : health ? 'offline' : 'unknown'
        },
        {
            icon: <Activity size={16} />,
            label: 'ACRCloud',
            value: acrcloudReady ? 'Configured' : 'Missing config',
            tone: acrcloudReady ? 'ready' : health ? 'warning' : 'unknown'
        },
        {
            icon: <Wrench size={16} />,
            label: 'FFmpeg',
            value: ffmpegReady ? 'Available' : 'Missing',
            tone: ffmpegReady ? 'ready' : health ? 'offline' : 'unknown'
        },
        {
            icon: <Bot size={16} />,
            label: 'Gemini',
            value: geminiReady ? 'Configured' : 'Optional',
            tone: geminiReady ? 'ready' : health ? 'warning' : 'unknown'
        }
    ];

    return (
        <div className="w-full max-w-4xl bg-gray-900/85 border border-gray-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-blue-400 font-bold">System Status</p>
                    <h2 className="text-lg font-semibold text-white mt-1">Check the stack before processing evidence.</h2>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 hover:bg-gray-700 disabled:opacity-60"
                >
                    <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                {items.map((item) => (
                    <div key={item.label} className="flex items-center gap-3 bg-gray-950/40 rounded-xl p-3 border border-gray-800">
                        <div className="text-blue-400">{item.icon}</div>
                        <div className="min-w-0 flex-1">
                            <StatusPill label={item.label} value={item.value} tone={item.tone} />
                        </div>
                    </div>
                ))}
            </div>

            {health && (
                <p className="text-xs text-gray-500 mt-4">
                    Node API: {health.api.reachable ? health.api.message : health.api.error} | Python AI: {health.pythonAi.reachable ? health.pythonAi.service : health.pythonAi.error}
                </p>
            )}
        </div>
    );
};

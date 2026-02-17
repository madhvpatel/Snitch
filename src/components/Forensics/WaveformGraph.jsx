import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { ZoomIn, ZoomOut, MoveLeft, MoveRight, RotateCcw } from 'lucide-react';
import { formatTime } from '../../services/audioUtils';

export const WaveformGraph = ({
    data,
    currentTime1,
    currentTime2,
    onSeek,
    duration,
    originalPeakRegion,
    isolatedPeakRegion
}) => {
    const [domain, setDomain] = useState([0, duration]);
    const [showOriginal, setShowOriginal] = useState(true);
    const [showIsolated, setShowIsolated] = useState(true);

    const [showVocals, setShowVocals] = useState(true);
    const [showDrums, setShowDrums] = useState(true);
    const [showBass, setShowBass] = useState(true);
    const [showOther, setShowOther] = useState(true);

    // Reset domain when duration changes (e.g. new file load)
    useEffect(() => {
        // Defer update to avoid synchronous render warning
        const t = setTimeout(() => {
            setDomain((prev) => (prev[1] !== duration ? [0, duration] : prev));
        }, 0);
        return () => clearTimeout(t);
    }, [duration]);

    const handleClick = (e) => {
        if (e && e.activeLabel !== undefined) {
            onSeek(Number(e.activeLabel));
        }
    };

    const handleZoomIn = () => {
        const [start, end] = domain;
        const span = end - start;
        const newSpan = span * 0.75; // Zoom in by 25%
        const mid = (start + end) / 2;
        setDomain([
            Math.max(0, mid - newSpan / 2),
            Math.min(duration, mid + newSpan / 2)
        ]);
    };

    const handleZoomOut = () => {
        const [start, end] = domain;
        const span = end - start;
        const newSpan = Math.min(duration, span * 1.25); // Zoom out by 25%
        const mid = (start + end) / 2;

        let newStart = mid - newSpan / 2;
        let newEnd = mid + newSpan / 2;

        // Clamp to bounds
        if (newStart < 0) {
            newStart = 0;
            newEnd = Math.min(duration, newSpan);
        }
        if (newEnd > duration) {
            newEnd = duration;
            newStart = Math.max(0, duration - newSpan);
        }

        setDomain([newStart, newEnd]);
    };

    const handlePanLeft = () => {
        const [start, end] = domain;
        const span = end - start;
        const shift = span * 0.1; // Shift by 10%
        const newStart = Math.max(0, start - shift);
        const newEnd = newStart + span;
        setDomain([newStart, newEnd]);
    };

    const handlePanRight = () => {
        const [start, end] = domain;
        const span = end - start;
        const shift = span * 0.1; // Shift by 10%
        const newEnd = Math.min(duration, end + shift);
        const newStart = newEnd - span;
        setDomain([newStart, newEnd]);
    };

    const handleReset = () => {
        setDomain([0, duration]);
    };

    if (data.length === 0) {
        return (
            <div className="h-full w-full bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200">
                <p className="text-slate-400">Processing audio data...</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Header & Controls */}
            <div className="flex justify-between items-center p-3 border-b border-slate-100 bg-slate-50 shrink-0">
                <h3 className="text-sm font-semibold text-slate-700">Amplitude Analysis</h3>

                <div className="flex items-center gap-4">
                    {/* Legend / Toggles */}
                    <div className="flex gap-2 text-[10px] uppercase tracking-wider font-semibold">
                        <button onClick={() => setShowOriginal(!showOriginal)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border ${showOriginal ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-400 border-slate-200 opacity-60 hover:opacity-100'}`} title="Original">
                            <span className={`w-2 h-2 rounded-full ${showOriginal ? 'bg-blue-500' : 'bg-slate-300'}`}></span><span>Full</span>
                        </button>

                        <button onClick={() => setShowVocals(!showVocals)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border ${showVocals ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-slate-400 border-slate-200 opacity-60 hover:opacity-100'}`} title="Vocals">
                            <span className={`w-2 h-2 rounded-full ${showVocals ? 'bg-violet-500' : 'bg-slate-300'}`}></span><span>Vocals</span>
                        </button>

                        <button onClick={() => setShowDrums(!showDrums)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border ${showDrums ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-400 border-slate-200 opacity-60 hover:opacity-100'}`} title="Drums">
                            <span className={`w-2 h-2 rounded-full ${showDrums ? 'bg-red-500' : 'bg-slate-300'}`}></span><span>Drums</span>
                        </button>

                        <button onClick={() => setShowBass(!showBass)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border ${showBass ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-white text-slate-400 border-slate-200 opacity-60 hover:opacity-100'}`} title="Bass">
                            <span className={`w-2 h-2 rounded-full ${showBass ? 'bg-yellow-500' : 'bg-slate-300'}`}></span><span>Bass</span>
                        </button>
                    </div>

                    <div className="h-4 w-px bg-slate-300 mx-2"></div>

                    {/* Controls */}
                    <div className="flex items-center gap-1">
                        <button onClick={handlePanLeft} className="p-1 hover:bg-white hover:text-blue-600 rounded text-slate-500 transition-colors" title="Pan Left">
                            <MoveLeft size={16} />
                        </button>
                        <button onClick={handleZoomOut} className="p-1 hover:bg-white hover:text-blue-600 rounded text-slate-500 transition-colors" title="Zoom Out">
                            <ZoomOut size={16} />
                        </button>
                        <button onClick={handleReset} className="p-1 hover:bg-white hover:text-blue-600 rounded text-slate-500 transition-colors" title="Reset View">
                            <RotateCcw size={14} />
                        </button>
                        <button onClick={handleZoomIn} className="p-1 hover:bg-white hover:text-blue-600 rounded text-slate-500 transition-colors" title="Zoom In">
                            <ZoomIn size={16} />
                        </button>
                        <button onClick={handlePanRight} className="p-1 hover:bg-white hover:text-blue-600 rounded text-slate-500 transition-colors" title="Pan Right">
                            <MoveRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0 w-full p-2 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        onClick={handleClick}
                        margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorOriginal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorVocals" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorDrums" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorBass" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="time"
                            type="number"
                            domain={domain}
                            allowDataOverflow={true}
                            tickFormatter={formatTime}
                            style={{ fontSize: '10px', fill: '#94a3b8' }}
                            height={20}
                            tickCount={10}
                        />
                        <YAxis hide domain={[0, 1]} />
                        <Tooltip
                            labelFormatter={(label) => formatTime(label)}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        />

                        {originalPeakRegion && showOriginal && (
                            <ReferenceArea
                                x1={originalPeakRegion.start}
                                x2={originalPeakRegion.end}
                                fill="#3b82f6"
                                fillOpacity={0.05}
                                strokeOpacity={0}
                                ifOverflow="hidden"
                            />
                        )}

                        <Area type="monotone" dataKey="original" stackId="1" stroke="#3b82f6" strokeWidth={1} fill="url(#colorOriginal)" isAnimationActive={false} hide={!showOriginal} />
                        <Area type="monotone" dataKey="vocals" stackId="2" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorVocals)" isAnimationActive={false} hide={!showVocals} />
                        <Area type="monotone" dataKey="drums" stackId="3" stroke="#ef4444" strokeWidth={2} fill="url(#colorDrums)" isAnimationActive={false} hide={!showDrums} />
                        <Area type="monotone" dataKey="bass" stackId="4" stroke="#eab308" strokeWidth={2} fill="url(#colorBass)" isAnimationActive={false} hide={!showBass} />

                        {/* Progress Lines */}
                        <ReferenceLine x={currentTime1} stroke="#3b82f6" strokeWidth={2} isFront label="" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

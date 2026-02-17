import React from 'react';
import { BrainCircuit, CheckCircle2, AlertTriangle, FileText, Music, Volume2, Shield, Scissors } from 'lucide-react';

export const AnalysisPanel = ({ report, isLoading, error, onGenerateReport, onIsolateVocals, isIsolating, isolationResult }) => {
    return (
        <div className="h-full w-full flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit size={18} className="text-purple-600" />
                    <h3 className="text-sm font-semibold text-slate-700">AI Forensic Tools</h3>
                </div>

                {(isLoading || isIsolating) && (
                    <span className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full animate-pulse border border-purple-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        {isIsolating ? 'Isolating...' : 'Analyzing...'}
                    </span>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
                        <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-500 rounded-full animate-spin"></div>
                        <div className="space-y-2 w-full max-w-[200px]">
                            <div className="h-2 bg-slate-100 rounded animate-pulse w-full"></div>
                            <div className="h-2 bg-slate-100 rounded animate-pulse w-[80%]"></div>
                            <div className="h-2 bg-slate-100 rounded animate-pulse w-[60%]"></div>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">Processing audio signatures...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <AlertTriangle size={32} className="text-red-400 mb-2" />
                        <p className="text-sm text-slate-600 font-medium">Analysis Failed</p>
                        <p className="text-xs text-slate-400 mt-1 mb-4">{error}</p>
                        <button
                            onClick={onGenerateReport}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold"
                        >
                            Retry Analysis
                        </button>
                    </div>
                ) : report ? (
                    <div className="space-y-4">
                        {/* Verdict Badge */}
                        <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg text-white shadow-md">
                            <Shield className="text-emerald-400" size={24} />
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Verdict</h4>
                                <p className="font-semibold text-sm">Source Audio Verified</p>
                            </div>
                        </div>

                        {/* Report Content */}
                        <div className="prose prose-sm prose-slate max-w-none">
                            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                {report}
                            </div>
                        </div>

                        {/* Metadata Chips (Mock) */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-medium text-slate-500">
                                <Music size={10} /> Music Detected
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-medium text-slate-500">
                                <Volume2 size={10} /> High Fidelity
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
                        <FileText size={48} className="text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500 mb-4">Ready to analyze audio forensics.</p>

                        <div className="flex flex-col gap-2 w-full max-w-xs">
                            <button
                                onClick={onGenerateReport}
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-purple-200 transition-all transform hover:scale-105 active:scale-95"
                            >
                                Generate AI Report
                            </button>

                            {onIsolateVocals && (
                                <button
                                    onClick={onIsolateVocals}
                                    disabled={isIsolating}
                                    className="flex items-center justify-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-200 transition-all transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
                                >
                                    <Scissors size={16} />
                                    {isIsolating ? 'Isolating...' : 'Isolate Vocals (GPU)'}
                                </button>
                            )}
                        </div>

                        {isolationResult && (
                            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg w-full max-w-xs">
                                <p className="text-xs font-semibold text-emerald-900 mb-2">✅ Stems Separated:</p>
                                <div className="space-y-1">
                                    {Object.entries(isolationResult).map(([stem, url]) => (
                                        <a
                                            key={stem}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-emerald-700 hover:text-emerald-900 underline block"
                                        >
                                            {stem}.wav
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

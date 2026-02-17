import React from 'react';
import { Music, CheckCircle, ShieldCheck, ShieldAlert, Building2, Activity, MapPin, Speaker } from 'lucide-react';
import { AnalysisPanel } from './Forensics/AnalysisPanel';

export const ResultDashboard = ({ song, location, forensicReport, permissions, requestForensics, speakerAuth }) => {
    // Determine overall status
    const isLicensed = permissions.status === 'licensed';
    const hasSong = !!song;
    const hasLocation = !!location;

    const isPASystem = speakerAuth?.label === "Large PA System";


    return (
        <div className="w-full max-w-6xl animate-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Song Identity Card */}
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col items-center text-center relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />

                    <div className="mb-4 p-4 bg-gray-700/50 rounded-full">
                        {song?.cover ? (
                            <img src={song.cover} alt="Art" className="w-24 h-24 rounded-full object-cover shadow-lg" />
                        ) : (
                            <Music size={40} className="text-blue-400" />
                        )}
                    </div>

                    {hasSong ? (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-1 line-clamp-1">{song.title}</h2>
                            <p className="text-lg text-gray-400 mb-4">{song.artist}</p>
                            <div className="mt-auto w-full">
                                <div className="bg-gray-700/50 py-2 rounded-lg mb-2">
                                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Label</span>
                                    <p className="text-sm font-medium text-white">{song.label}</p>
                                </div>
                                <div className="bg-gray-700/50 py-2 rounded-lg">
                                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Rights / PRO</span>
                                    <p className="text-sm font-medium text-white">{song.pro}</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-50">
                            <p>Song not identified</p>
                        </div>
                    )}
                </div>

                {/* 2. Venue & Licensing Card */}
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-1 ${isLicensed ? 'bg-green-500' : 'bg-red-500'}`} />

                    <div className="mb-4 flex justify-center">
                        <div className={`p-4 rounded-full ${isLicensed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {isLicensed ? <ShieldCheck size={40} /> : <ShieldAlert size={40} />}
                        </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">
                        {isLicensed ? "License Verified" : "Unlicensed Performance"}
                    </h3>

                    {hasLocation && location.venue && (
                        <div className="flex items-center justify-center gap-2 mb-6 bg-gray-700/30 py-2 px-4 rounded-full mx-auto">
                            <Building2 size={16} className="text-blue-400" />
                            <span className="text-sm text-gray-300 font-medium">{location.venue}</span>
                        </div>
                    )}

                    <div className="mt-auto space-y-3">
                        <div className="flex items-center justify-between text-sm text-gray-400 border-b border-gray-700 pb-2">
                            <span>Proof Hash</span>
                            <span className="font-mono text-xs">{location?.hash?.substring(0, 10)}...</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-400 border-b border-gray-700 pb-2">
                            <span className="flex items-center gap-1"><MapPin size={12} /> Accuracy</span>
                            <span>{location?.accuracy?.toFixed(1)}m</span>
                        </div>
                    </div>
                </div>

                {/* 3. Forensic Brief */}
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500" />

                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-yellow-500/10 text-yellow-400 rounded-lg">
                            <Activity size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Forensic Analysis</h3>
                    </div>

                    {speakerAuth && (
                        <div className={`mb-4 p-3 rounded-lg border ${isPASystem ? 'bg-green-900/20 border-green-700' : 'bg-red-900/20 border-red-700'} flex items-center justify-between`}>
                            <div className="flex items-center gap-2">
                                <Speaker size={18} className={isPASystem ? 'text-green-400' : 'text-red-400'} />
                                <div>
                                    <p className="text-xs text-gray-400 font-bold uppercase">Source Prob.</p>
                                    <p className={`text-sm font-bold ${isPASystem ? 'text-green-300' : 'text-red-300'}`}>
                                        {speakerAuth.label}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 font-mono">Sub/Mid</p>
                                <p className="text-sm font-mono text-gray-300">{speakerAuth.ratio.toFixed(2)}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto max-h-[150px] mb-4 pr-1 scrollbar-thin scrollbar-thumb-gray-600">
                        {forensicReport ? (
                            <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                                {forensicReport}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="h-2 bg-gray-700 rounded animate-pulse w-3/4"></div>
                                <div className="h-2 bg-gray-700 rounded animate-pulse w-full"></div>
                                <div className="h-2 bg-gray-700 rounded animate-pulse w-5/6"></div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Action Bar */}
            <div className="mt-8 flex justify-center">
                <button
                    onClick={requestForensics}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                >
                    <Activity size={20} />
                    Open Detailed Forensic Lab
                </button>
            </div>
        </div>
    );
};

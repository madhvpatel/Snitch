import React, { useState } from 'react';
import { MapPin, ShieldCheck, Hash, Clock, Navigation, Map } from 'lucide-react';

const LocationPrompt = ({ locationData, proofHash, onConfirm, bestMatch, suggestions }) => {
    const [venueName, setVenueName] = useState('');
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [showManual, setShowManual] = useState(false);

    const getAccuracyColor = (metres) => {
        if (metres < 20) return 'text-green-400';
        if (metres < 100) return 'text-yellow-400';
        return 'text-red-400';
    };

    const handleConfirm = (selectedName) => {
        const name = selectedName || venueName;
        if (!name.trim()) return;
        setIsConfirmed(true);
        onConfirm(name);
    };

    if (isConfirmed) return null;

    return (
        <div className="w-full bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-2xl animate-in fade-in zoom-in duration-500">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={20} className="text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Proof of Location</span>
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-bold ${getAccuracyColor(locationData.accuracy)}`}>
                    <Navigation size={12} />
                    {locationData.accuracy}m Accuracy
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <MapPin className="text-blue-500" size={24} />
                    Where are you right now?
                </h2>
                {bestMatch && (
                    <p className="text-sm text-gray-400 mb-4">
                        Best nearby match: <span className="text-blue-400 font-semibold">{bestMatch}</span>
                    </p>
                )}

                {!showManual ? (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                        {suggestions && suggestions.length > 0 ? (
                            <>
                                {suggestions.map((venue, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleConfirm(venue.name)}
                                        className="w-full text-left p-4 rounded-lg bg-gray-900 border border-gray-700 hover:border-blue-500 hover:bg-gray-700/30 transition-all flex items-center justify-between group active:scale-[0.98]"
                                    >
                                        <div className="truncate pr-4">
                                            <div className="text-sm font-bold text-white group-hover:text-blue-400">{venue.name}</div>
                                            <div className="text-[10px] text-gray-500 truncate">{venue.address}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs font-mono font-bold text-blue-400">{venue.distance}m</div>
                                            <div className="text-[9px] text-gray-600 uppercase">away</div>
                                        </div>
                                    </button>
                                ))}
                                <button
                                    onClick={() => setShowManual(true)}
                                    className="w-full py-3 text-sm text-gray-500 hover:text-blue-400 transition-colors border-t border-gray-700 mt-2 font-medium"
                                >
                                    Don't see your place? Enter manually
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-sm text-gray-500 mb-4 text-pretty">No nearby venues found within 500m.</p>
                                <button
                                    onClick={() => setShowManual(true)}
                                    className="bg-blue-600 px-6 py-2 rounded-lg font-bold text-sm"
                                >
                                    Enter Manually
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-in slide-in-from-right-4 duration-300">
                        <div className="relative mb-4">
                            <input
                                type="text"
                                value={venueName}
                                onChange={(e) => setVenueName(e.target.value)}
                                placeholder="Business or venue name..."
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-600"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowManual(false)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-bold"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => handleConfirm()}
                                disabled={!venueName.trim()}
                                className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 py-3 rounded-lg font-bold active:scale-95 transition-transform"
                            >
                                Confirm & Sign
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 bg-gray-900/30 p-3 rounded-lg border border-gray-700/30">
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-tighter text-gray-500 flex items-center gap-1">
                        <Map size={10} /> Coordinates
                    </span>
                    <span className="text-xs font-mono text-gray-300">
                        {locationData.lat.toFixed(4)}, {locationData.lon.toFixed(4)}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-tighter text-gray-500 flex items-center gap-1">
                        <Clock size={10} /> Timestamp
                    </span>
                    <span className="text-xs font-mono text-gray-300">
                        {new Date(locationData.timestamp).toLocaleTimeString()}
                    </span>
                </div>
                <div className="col-span-2 flex flex-col gap-1 pt-2 border-t border-gray-800 mt-1">
                    <span className="text-[9px] uppercase tracking-tighter text-gray-500 flex items-center gap-1">
                        <Hash size={10} /> Tamper-Proof Signature
                    </span>
                    <span className="text-[9px] font-mono text-blue-400/70 truncate">
                        {proofHash}
                    </span>
                </div>
            </div>

            <button
                onClick={() => handleConfirm(bestMatch)}
                disabled={!bestMatch}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
                {bestMatch ? `Use ${bestMatch}` : 'Confirm & Sign Report'}
            </button>
        </div>
    );
};

export default LocationPrompt;

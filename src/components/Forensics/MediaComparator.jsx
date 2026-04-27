import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, Link2, Link2Off } from 'lucide-react';
import { WaveformGraph } from './WaveformGraph';
import { AnalysisPanel } from './AnalysisPanel';
import { decodeAudioFile, extractAudioPeaks, createAudioSnippet } from '../../services/audioUtils';
import { requestForensicReport } from '../../services/api';
import { PYTHON_API_BASE_URL } from '../../services/config';
import { FileUpload } from './FileUpload';

export const MediaComparator = ({
    audioBlob,
    videoFile: initialVideoFile,
    onReset
}) => {
    // Media State
    const [videoFile, setVideoFile] = useState(initialVideoFile || null);
    const [isSynced, setIsSynced] = useState(true);
    const [isPlaying1, setIsPlaying1] = useState(false);
    const [isPlaying2, setIsPlaying2] = useState(false);

    const [currentTime1, setCurrentTime1] = useState(0);
    const [currentTime2, setCurrentTime2] = useState(0);
    const [duration, setDuration] = useState(0);

    // Analysis Data State
    const [analysis, setAnalysis] = useState({
        isProcessing: false,
        data: [],
        duration: 0,
        originalPeakRegion: undefined,
        isolatedPeakRegion: undefined,
        error: null,
        stemBuffers: {}
    });

    // AI Report State
    const [aiReport, setAiReport] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);

    // Isolation State (Demucs)
    const [isolationResult, setIsolationResult] = useState(null); // { vocals: url, drums: url, ... }
    const [isIsolating, setIsIsolating] = useState(false);

    // Refs for media elements
    const videoOriginalRef = useRef(null);
    const videoMutedRef = useRef(null);
    const audioIsolatedRef = useRef(null);

    // Refs for URLs to cleanup
    const videoUrlRef = useRef('');
    const audioUrlRef = useRef('');
    const animationFrameRef = useRef();

    const audioBufferRef = useRef(null);

    // Helper to fetch and decode stem
    const fetchAndDecodeStem = async (url) => {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            audioCtx.close();
            return audioBuffer;
        } catch (e) {
            console.error(`Error decoding stem from ${url}:`, e);
            return null;
        }
    };

    // Initialize Media & Analysis (Auto-Isolation Flow)
    useEffect(() => {
        videoUrlRef.current = URL.createObjectURL(videoFile);
        audioUrlRef.current = audioBlob ? URL.createObjectURL(audioBlob) : '';

        if (videoOriginalRef.current) videoOriginalRef.current.src = videoUrlRef.current;
        if (videoMutedRef.current) videoMutedRef.current.src = videoUrlRef.current;
        if (audioIsolatedRef.current && audioBlob) audioIsolatedRef.current.src = audioUrlRef.current;

        const processFiles = async () => {
            setAnalysis(prev => ({ ...prev, isProcessing: true }));
            setIsIsolating(true);

            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

                // 1. Decode Original
                const originalBuffer = await decodeAudioFile(videoFile, audioCtx);
                const isolatedBuffer = audioBlob ? await decodeAudioFile(audioBlob, audioCtx) : null;
                audioBufferRef.current = originalBuffer; // Store for AI

                // 2. Perform Auto-Isolation (Demucs)
                let stemBuffers = {};

                try {
                    const formData = new FormData();
                    formData.append('audio', videoFile);

                    // Call Local Python AI Service (Port 5001)
                    const response = await fetch(`${PYTHON_API_BASE_URL}/api/isolate`, {
                        method: 'POST',
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setIsolationResult(data.stems);

                        // Fetch and decode stems
                        const stems = ['vocals', 'drums', 'bass', 'other'];
                        await Promise.all(stems.map(async (stem) => {
                            if (data.stems[stem]) {
                                const buffer = await fetchAndDecodeStem(data.stems[stem]);
                                if (buffer) stemBuffers[stem] = buffer;
                            }
                        }));
                    } else {
                        console.warn("Isolation failed, proceeding with original only");
                    }
                } catch (isoErr) {
                    console.error("Auto-isolation skipped/failed:", isoErr);
                }

                // 3. Setup Graph Data (Now including stems!)
                const maxDuration = Math.max(originalBuffer.duration, isolatedBuffer?.duration || 0);
                setDuration(maxDuration);

                const { points, originalPeakRegion, isolatedPeakRegion } = extractAudioPeaks(
                    originalBuffer,
                    isolatedBuffer,
                    500,
                    stemBuffers // Pass the separated stems
                );

                setAnalysis({
                    isProcessing: false,
                    data: points,
                    duration: maxDuration,
                    originalPeakRegion,
                    isolatedPeakRegion,
                    stemBuffers
                });

                audioCtx.close();
            } catch (err) {
                console.error("Error processing media", err);
                setAnalysis(prev => ({ ...prev, isProcessing: false, error: "Failed to analyze audio data" }));
            } finally {
                setIsIsolating(false);
            }
        };

        processFiles();

        return () => {
            URL.revokeObjectURL(videoUrlRef.current);
            if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [videoFile, audioBlob]);

    // Helper to capture video frame as base64
    const captureVideoFrame = (videoElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    };

    const generateAiReport = async () => {
        const buffer = audioBufferRef.current;
        if (!buffer) {
            setAiError("Audio not ready yet");
            return;
        }

        setAiLoading(true);
        setAiError(null);

        try {
            // 1. Find the loudest part of the track for analysis
            const rawData = buffer.getChannelData(0);
            let maxAmp = 0;
            let maxIndex = 0;
            const step = 1000;
            for (let i = 0; i < rawData.length; i += step) {
                const amp = Math.abs(rawData[i]);
                if (amp > maxAmp) {
                    maxAmp = amp;
                    maxIndex = i;
                }
            }
            const peakTime = maxIndex / buffer.sampleRate;

            // 2. Seek video to peak time and capture frame
            let base64Image = null;
            if (videoOriginalRef.current) {
                videoOriginalRef.current.currentTime = peakTime;
                // Wait briefly for seek to complete (naive approach)
                await new Promise(r => setTimeout(r, 200));
                base64Image = captureVideoFrame(videoOriginalRef.current);
            }

            // 3. Create Audio Snippet (10s around peak)
            const snippet = createAudioSnippet(buffer, {
                durationSeconds: 10,
                centerTime: peakTime
            });
            const report = await requestForensicReport({
                audioBlob: snippet.blob,
                peakTime,
                frameDataUrl: base64Image ? `data:image/jpeg;base64,${base64Image}` : null,
                mode: 'detail'
            });
            setAiReport(report);

        } catch (err) {
            console.error("AI Report Error:", err);
            setAiError(err.message || "Failed to generate AI report");
        } finally {
            setAiLoading(false);
        }
    };


    const handleIsolateVocals = async () => {
        if (!videoFile) return;
        setIsIsolating(true);
        setAiError(null);

        try {
            const formData = new FormData();
            formData.append('audio', videoFile);

            // Call Local Python AI Service (Port 5001)
            const response = await fetch(`${PYTHON_API_BASE_URL}/api/isolate`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Isolation failed');
            }

            const data = await response.json();
            setIsolationResult(data.stems);

            // Fetch and decode stems for visualization
            const stemBuffers = {};
            const stems = ['vocals', 'drums', 'bass', 'other'];

            await Promise.all(stems.map(async (stem) => {
                if (data.stems[stem]) {
                    const buffer = await fetchAndDecodeStem(data.stems[stem]);
                    if (buffer) stemBuffers[stem] = buffer;
                }
            }));

            // Pass stems to WaveformGraph via analysis state
            setAnalysis(prev => ({
                ...prev,
                stemBuffers
            }));

        } catch (err) {
            console.error("Isolation error:", err);
            setAiError("Local AI Isolation failed (Is Python Server running on 5001?)");
        } finally {
            setIsIsolating(false);
        }
    };


    // Sync Loop
    const syncLoop = useCallback(() => {
        const v1 = videoOriginalRef.current;
        const v2 = videoMutedRef.current;
        const a1 = audioIsolatedRef.current;

        if (!v1 || !v2 || !a1) return;

        setCurrentTime1(v1.currentTime);
        setCurrentTime2(v2.currentTime);

        // Drift Correction if Linked
        if (isSynced && !v1.paused) {
            const tolerance = 0.15;
            if (Math.abs(v2.currentTime - v1.currentTime) > tolerance) v2.currentTime = v1.currentTime;
            if (Math.abs(a1.currentTime - v1.currentTime) > tolerance) a1.currentTime = v1.currentTime;
        }

        if (!v1.paused || !v2.paused || !a1.paused) {
            animationFrameRef.current = requestAnimationFrame(syncLoop);
        }
    }, [isSynced]);

    // Restart loop on play state change
    useEffect(() => {
        if (isPlaying1 || isPlaying2) {
            animationFrameRef.current = requestAnimationFrame(syncLoop);
        }
    }, [isPlaying1, isPlaying2, syncLoop]);

    const handleGlobalPlayPause = () => {
        const v1 = videoOriginalRef.current;
        const v2 = videoMutedRef.current;
        const a1 = audioIsolatedRef.current;
        if (!v1 || !v2 || !a1) return;

        if (isPlaying1) {
            v1.pause();
            v2.pause();
            a1.pause();
            setIsPlaying1(false);
            setIsPlaying2(false);
        } else {
            if (isSynced) {
                v2.currentTime = v1.currentTime;
                a1.currentTime = v1.currentTime;
            }
            v1.play();
            v2.play();
            a1.play();
            setIsPlaying1(true);
            setIsPlaying2(true);
        }
    };

    const handleToggle1 = () => {
        const v1 = videoOriginalRef.current;
        if (!v1) return;

        if (v1.paused) {
            v1.play();
            setIsPlaying1(true);
            if (isSynced) {
                videoMutedRef.current?.play();
                audioIsolatedRef.current?.play();
                setIsPlaying2(true);
            }
        } else {
            v1.pause();
            setIsPlaying1(false);
            if (isSynced) {
                videoMutedRef.current?.pause();
                audioIsolatedRef.current?.pause();
                setIsPlaying2(false);
            }
        }
    };

    const handleToggle2 = () => {
        const v2 = videoMutedRef.current;
        const a1 = audioIsolatedRef.current;
        if (!v2 || !a1) return;

        if (v2.paused) {
            v2.play();
            a1.play();
            setIsPlaying2(true);
            if (isSynced) {
                videoOriginalRef.current?.play();
                setIsPlaying1(true);
            }
        } else {
            v2.pause();
            a1.pause();
            setIsPlaying2(false);
            if (isSynced) {
                videoOriginalRef.current?.pause();
                setIsPlaying1(false);
            }
        }
    };

    const handleSeek = (time) => {
        const v1 = videoOriginalRef.current;
        const v2 = videoMutedRef.current;
        const a1 = audioIsolatedRef.current;

        if (v1) {
            v1.currentTime = time;
            setCurrentTime1(time);
        }

        if (isSynced && v2 && a1) {
            v2.currentTime = time;
            a1.currentTime = time;
            setCurrentTime2(time);
        } else if (!isSynced && v2 && a1) {
            v2.currentTime = time;
            a1.currentTime = time;
            setCurrentTime2(time);
        }
    };

    const handleSeekRange = (e) => {
        handleSeek(Number(e.target.value));
    };


    if (!videoFile) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-sm border border-slate-200 mt-4 min-h-[300px]">
                <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Upload Video Proof</h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2">
                        Upload the original video source to compare against your captured audio signature.
                    </p>
                </div>
                <div className="w-full max-w-sm">
                    <FileUpload
                        label="Select Video File"
                        accept="video/*"
                        file={videoFile}
                        onFileSelect={setVideoFile}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[700px] w-full bg-slate-50 rounded-xl overflow-hidden shadow-2xl border border-slate-200 mt-4">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0 shadow-sm z-20 h-14">
                <div className="flex items-center gap-4">
                    {/* Close Button */}
                    <button
                        onClick={onReset}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mr-2"
                        title="Close Forensic Verification"
                    >
                        <span className="font-bold text-lg">×</span>
                    </button>

                    <button
                        onClick={() => setVideoFile(null)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Upload new video"
                    >
                        <RotateCcw size={18} />
                    </button>

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    <button
                        onClick={() => setIsSynced(!isSynced)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all
               ${isSynced
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                    >
                        {isSynced ? <Link2 size={14} /> : <Link2Off size={14} />}
                        {isSynced ? 'Linked' : 'Unlinked'}
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {analysis.isProcessing && (
                        <span className="text-xs text-slate-400 animate-pulse">Processing media...</span>
                    )}
                    <button
                        onClick={handleGlobalPlayPause}
                        className="flex items-center gap-2 px-6 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium text-sm transition-colors shadow-sm"
                    >
                        {isPlaying1 && isPlaying2 ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                        {isPlaying1 && isPlaying2 ? "Pause" : "Play"}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col flex-1 min-h-0">

                {/* Videos Area (50%) */}
                <div className="h-1/2 min-h-[300px] shrink-0 grid grid-cols-2 gap-1 bg-black/5 p-1">
                    {/* Player 1 */}
                    <div className={`relative bg-black rounded-lg overflow-hidden group border-2 ${isPlaying1 ? 'border-blue-500' : 'border-transparent'}`}>
                        <video
                            ref={videoOriginalRef}
                            className="w-full h-full object-contain"
                            onEnded={() => setIsPlaying1(false)}
                            onClick={handleToggle1}
                        />
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-medium text-white flex items-center gap-2 pointer-events-none">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div> Original Video
                        </div>
                    </div>

                    {/* Player 2 */}
                    <div className={`relative bg-black rounded-lg overflow-hidden group border-2 ${isPlaying2 ? 'border-emerald-500' : 'border-transparent'}`}>
                        <video
                            ref={videoMutedRef}
                            className="w-full h-full object-contain"
                            muted
                            onClick={handleToggle2}
                        />
                        <audio ref={audioIsolatedRef} className="hidden" onEnded={() => setIsPlaying2(false)} />
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-medium text-white flex items-center gap-2 pointer-events-none">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Captured Audio Sync
                        </div>
                    </div>
                </div>

                {/* Bottom Panel (Remaining) */}
                <div className="flex-1 min-h-0 flex flex-col bg-white border-t border-slate-200">

                    {/* Scrubber */}
                    <div className="h-6 w-full relative group cursor-pointer bg-slate-50 shrink-0 border-b border-slate-100">
                        <div className="absolute w-full h-full flex items-center px-0">
                            <div className="w-full h-full bg-slate-100 relative overflow-hidden">
                                <div className="absolute top-0 bottom-0 bg-blue-500/30" style={{ width: `${(currentTime1 / (duration || 1)) * 100}%` }} />
                                {!isSynced && (
                                    <div className="absolute top-0 bottom-0 bg-emerald-500/30" style={{ width: `${(currentTime2 / (duration || 1)) * 100}%` }} />
                                )}
                            </div>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            step={0.01}
                            value={currentTime1}
                            onChange={handleSeekRange}
                            className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                        />
                    </div>

                    {/* Analysis & Graph */}
                    <div className="flex-1 min-h-0 flex overflow-hidden p-3 gap-3">

                        {/* Waveform (Left) */}
                        <div className="flex-[3] min-w-0 h-full">
                            <WaveformGraph
                                data={analysis.data}
                                currentTime1={currentTime1}
                                duration={analysis.duration}
                                onSeek={handleSeek}
                                originalPeakRegion={analysis.originalPeakRegion}
                                stemBuffers={analysis.stemBuffers}
                            />
                        </div>

                        {/* AI Panel (Right) */}
                        <div className="flex-1 min-w-[320px] max-w-md h-full">
                            <AnalysisPanel
                                report={aiReport}
                                isLoading={aiLoading}
                                error={aiError}
                                onGenerateReport={generateAiReport}
                                onIsolateVocals={handleIsolateVocals}
                                isIsolating={isIsolating}
                                isolationResult={isolationResult}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

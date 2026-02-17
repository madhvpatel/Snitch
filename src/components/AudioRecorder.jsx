import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

const AudioRecorder = ({ onRecordingComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const RECORDING_DURATION = 12; // seconds

    // Pre-calculate random heights for the visualizer to avoid impure render
    const [barHeights] = useState(() => Array(5).fill(0).map(() => 40 + Math.random() * 60));

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    useEffect(() => {
        if (isRecording && countdown > 0) {
            const timer = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        } else if (isRecording && countdown === 0) {
            stopRecording();
        }
    }, [isRecording, countdown]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                onRecordingComplete(blob);
                stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setCountdown(RECORDING_DURATION);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    // Calculate countdown path for circular progress
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const offset = isRecording ? circumference - (circumference * (RECORDING_DURATION - countdown)) / RECORDING_DURATION : circumference;

    return (
        <div className="flex flex-col items-center gap-6 p-8 bg-gray-800/50 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700 w-full max-w-sm transition-all duration-500">
            <div
                onClick={!isRecording ? startRecording : undefined}
                className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 group
                    ${isRecording
                        ? 'bg-red-500/10 shadow-[0_0_40px_rgba(239,68,68,0.2)]'
                        : 'bg-blue-600 hover:bg-blue-500 shadow-xl cursor-pointer hover:scale-105 active:scale-95'
                    }`}
            >
                {/* Progress Ring Overlay */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        className="text-gray-700"
                    />
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="text-red-500 transition-all duration-1000 linear"
                    />
                </svg>

                <div className="z-10 flex flex-col items-center justify-center">
                    {isRecording ? (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                            <span className="text-3xl font-black text-white">{countdown}</span>
                            <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">SEC LEFT</span>
                        </div>
                    ) : (
                        <Mic size={48} className="text-white group-hover:animate-pulse" />
                    )}
                </div>
            </div>

            <div className="text-center space-y-1">
                <p className="text-white text-lg font-bold tracking-tight">
                    {isRecording ? "Fingerprinting..." : "Identify Song"}
                </p>
                <p className="text-gray-400 text-sm font-medium">
                    {isRecording ? "Capturing audio signature" : "Single tap to verify license"}
                </p>
            </div>

            {isRecording && (
                <div className="flex gap-1.5 items-end h-4">
                    {[0, 0.2, 0.4, 0.1, 0.3].map((delay, i) => (
                        <div
                            key={i}
                            className="w-1.5 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${delay}s`, height: `${barHeights[i]}%` }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AudioRecorder;

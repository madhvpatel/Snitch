import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';

const LyricsRecognizer = ({ onLyricsComplete }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [supported, setSupported] = useState(true);
    const recognitionRef = useRef(null);

    useEffect(() => {
        // Check if browser supports Web Speech API
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setSupported(false);
            return;
        }

        // Initialize speech recognition
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptPiece = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcriptPiece + ' ';
                } else {
                    interim += transcriptPiece;
                }
            }

            if (final) {
                setTranscript(prev => prev + final);
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone permissions.');
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            if (isListening) {
                // Restart if it stops unexpectedly
                recognition.start();
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognition) {
                recognition.stop();
            }
        };
    }, [isListening]);

    const startListening = () => {
        if (!recognitionRef.current) return;

        setTranscript('');
        setInterimTranscript('');
        setIsListening(true);

        try {
            recognitionRef.current.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
        }
    };

    const stopListening = () => {
        if (!recognitionRef.current) return;

        setIsListening(false);
        recognitionRef.current.stop();

        // Send final transcript to parent
        const finalText = transcript + interimTranscript;
        if (finalText.trim()) {
            onLyricsComplete(finalText.trim());
        }
    };

    const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '');

    if (!supported) {
        return (
            <div className="flex flex-col items-center gap-4 p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
                <div className="text-red-400 text-center">
                    <p className="font-bold mb-2">Speech Recognition Not Supported</p>
                    <p className="text-sm text-gray-400">
                        Please use Chrome, Edge, or Safari for lyrics recognition.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isListening
                    ? 'bg-purple-500 animate-pulse shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                    : 'bg-purple-600 hover:bg-purple-500'
                }`}>
                {isListening ? (
                    <Square size={40} className="text-white cursor-pointer" onClick={stopListening} />
                ) : (
                    <Volume2 size={40} className="text-white cursor-pointer" onClick={startListening} />
                )}
            </div>

            <p className="text-gray-300 font-medium">
                {isListening ? "Listening to lyrics..." : "Tap to Sing/Speak"}
            </p>

            {displayText && (
                <div className="w-full max-w-md mt-4 p-4 bg-gray-900 rounded-lg border border-purple-500/30">
                    <p className="text-sm text-gray-400 mb-2 uppercase tracking-wide">Transcribed Lyrics:</p>
                    <p className="text-white leading-relaxed">
                        {displayText}
                        {isListening && <span className="inline-block w-2 h-4 ml-1 bg-purple-400 animate-pulse"></span>}
                    </p>
                </div>
            )}

            <p className="text-xs text-gray-500 text-center max-w-sm">
                Sing or speak the lyrics clearly. The more lyrics you provide, the better the match!
            </p>
        </div>
    );
};

export default LyricsRecognizer;

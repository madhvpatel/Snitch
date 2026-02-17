import React, { useRef, useState } from 'react';
import { UploadCloud, FileVideo, CheckCircle, AlertCircle } from 'lucide-react';

export const VideoUploader = ({ onVideoUpload, isProcessing }) => {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const validateAndUpload = (file) => {
        setError(null);
        if (!file.type.startsWith('video/')) {
            setError("Please upload a valid video file.");
            return;
        }
        // Limit size if needed (e.g. 100MB)
        if (file.size > 100 * 1024 * 1024) {
            setError("File size exceeds 100MB limit.");
            return;
        }

        onVideoUpload(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndUpload(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            validateAndUpload(e.target.files[0]);
        }
    };

    const onButtonClick = () => {
        inputRef.current.click();
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div
                className={`relative group flex flex-col items-center justify-center w-full h-80 rounded-3xl border-4 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                    ${dragActive
                        ? 'border-blue-500 bg-blue-500/10 scale-102 shadow-2xl shadow-blue-500/20'
                        : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-blue-400 hover:shadow-xl'
                    }
                    ${isProcessing ? 'opacity-50 pointer-events-none grayscale' : ''}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
            >
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept="video/*"
                    onChange={handleChange}
                    disabled={isProcessing}
                />

                <div className="flex flex-col items-center text-center p-8 space-y-4 z-10">
                    <div className={`p-6 rounded-full transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6
                        ${dragActive ? 'bg-blue-500 text-white' : 'bg-gray-700 text-blue-400'}
                    `}>
                        {isProcessing ? (
                            <UploadCloud size={48} className="animate-bounce" />
                        ) : (
                            <FileVideo size={48} />
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-white tracking-tight">
                            {isProcessing ? "Processing Evidence..." : "Drop Video Proof Here"}
                        </h3>
                        <p className="text-gray-400 font-medium">
                            {isProcessing ? "Extracting audio & analyzing fingerprints" : "or click to browse your files"}
                        </p>
                    </div>

                    {!isProcessing && (
                        <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest mt-4">
                            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-500" /> MP4</span>
                            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-500" /> MOV</span>
                            <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-500" /> WebM</span>
                        </div>
                    )}
                </div>

                {/* Background Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>

            {error && (
                <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-900/50 animate-in slide-in-from-top-2">
                    <AlertCircle size={18} />
                    <span className="font-medium text-sm">{error}</span>
                </div>
            )}
        </div>
    );
};

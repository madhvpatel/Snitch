import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

export const FileUpload = ({ label, accept, file, onFileSelect, icon }) => {
    const inputRef = useRef(null);

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileSelect(e.dataTransfer.files[0]);
        }
    };

    return (
        <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
        relative group border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer
        ${file
                    ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'}
      `}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleChange}
                className="hidden"
            />

            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg transition-colors ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 group-hover:text-blue-500'}`}>
                    {icon || <Upload size={24} />}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-700 truncate">
                        {file ? file.name : label}
                    </p>
                    <p className="text-xs text-slate-400">
                        {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Click or drag to upload"}
                    </p>
                </div>
            </div>
        </div>
    );
};

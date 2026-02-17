import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { createWorker } from 'tesseract.js';

const LicenseUploader = ({ onLicenseVerified }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('idle'); // idle, processing, success, error
    const [message, setMessage] = useState('');

    const processImage = async (file) => {
        setIsProcessing(true);
        setUploadStatus('processing');
        setMessage('Scanning certificate...');

        try {
            const worker = await createWorker('eng');
            const ret = await worker.recognize(file);
            const text = ret.data.text;
            await worker.terminate();

            console.log("OCR Text:", text);

            // Basic Validation Logic (Mocking the "Digital Notary")
            const hasASCAP = /ASCAP/i.test(text);
            const hasBMI = /BMI/i.test(text);
            const yearMatch = text.match(/20\d{2}/); // Find a year
            const currentYear = new Date().getFullYear();

            let detectedPRO = [];
            if (hasASCAP) detectedPRO.push('ASCAP');
            if (hasBMI) detectedPRO.push('BMI');

            if (detectedPRO.length > 0) {
                setUploadStatus('success');
                setMessage(`Verified: ${detectedPRO.join(', ')} License found.`);
                onLicenseVerified({ pros: detectedPRO, rawText: text, file });
            } else {
                setUploadStatus('error');
                setMessage('Could not verify license. Ensure PRO name (ASCAP/BMI) is visible.');
            }

        } catch (err) {
            console.error(err);
            setUploadStatus('error');
            setMessage('Error processing image.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            processImage(e.target.files[0]);
        }
    };

    return (
        <div className="w-full max-w-md p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 mt-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="text-blue-400" /> License Wallet
            </h3>

            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors relative">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                />

                {isProcessing ? (
                    <div className="flex flex-col items-center">
                        <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
                        <p className="text-gray-400">Verifying...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <Upload className="text-gray-400 mb-2" size={32} />
                        <p className="text-gray-300">Upload Certificate</p>
                        <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG</p>
                    </div>
                )}
            </div>

            {uploadStatus !== 'idle' && (
                <div className={`mt-4 p-3 rounded-lg flex items-start gap-3 ${uploadStatus === 'success' ? 'bg-green-900/30 text-green-400' : uploadStatus === 'error' ? 'bg-red-900/30 text-red-400' : 'bg-gray-700 text-gray-300'}`}>
                    {uploadStatus === 'success' ? <CheckCircle size={20} /> : uploadStatus === 'error' ? <XCircle size={20} /> : null}
                    <p className="text-sm">{message}</p>
                </div>
            )}
        </div>
    );
};

export default LicenseUploader;

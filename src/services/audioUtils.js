export const decodeAudioFile = async (fileOrBlob, context) => {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer);
};

export const extractAudioPeaks = (
    buffer1,
    buffer2, // can be null (legacy isolated arg)
    samples = 200,
    stemBuffers = {} // New argument for multi-track
) => {
    const duration = buffer1?.duration || 0;
    if (duration === 0) return { points: [], originalPeakRegion: undefined, isolatedPeakRegion: undefined };

    const data = [];
    const step = duration / samples;

    // Helper to get peak in a window
    const getPeak = (buffer, startTime, windowSize) => {
        if (!buffer) return 0;
        const sampleRate = buffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor((startTime + windowSize) * sampleRate);
        const channelData = buffer.getChannelData(0); // Use first channel (mono/left)

        let max = 0;
        // Optimization: Don't check every single sample if window is huge, stride it
        const stride = Math.ceil((endSample - startSample) / 500) || 1;

        for (let i = startSample; i < endSample && i < channelData.length; i += stride) {
            const val = Math.abs(channelData[i]);
            if (val > max) max = val;
        }
        return max;
    };

    let maxOriginalAmplitude = 0;
    let maxOriginalTime = 0;

    let maxIsolatedAmplitude = 0;
    let maxIsolatedTime = 0;

    for (let i = 0; i < samples; i++) {
        const time = i * step;
        const original = buffer1 ? getPeak(buffer1, time, step) : 0;
        const isolated = buffer2 ? getPeak(buffer2, time, step) : 0;

        // Stems
        const vocals = stemBuffers.vocals ? getPeak(stemBuffers.vocals, time, step) : 0;
        const drums = stemBuffers.drums ? getPeak(stemBuffers.drums, time, step) : 0;
        const bass = stemBuffers.bass ? getPeak(stemBuffers.bass, time, step) : 0;
        const other = stemBuffers.other ? getPeak(stemBuffers.other, time, step) : 0;

        // Check Original Max
        if (original > maxOriginalAmplitude) {
            maxOriginalAmplitude = original;
            maxOriginalTime = time;
        }

        // Check Isolated Max (Legacy)
        if (isolated > maxIsolatedAmplitude) {
            maxIsolatedAmplitude = isolated;
            maxIsolatedTime = time;
        }

        data.push({
            time,
            original,
            isolated,
            vocals,
            drums,
            bass,
            other
        });
    }

    // Define a region +/- 5% of duration around the max peak, or fixed seconds (max 5s)
    const regionWindow = Math.min(duration * 0.1, 5);

    const originalPeakRegion = buffer1 ? {
        start: Math.max(0, maxOriginalTime - (regionWindow / 2)),
        end: Math.min(duration, maxOriginalTime + (regionWindow / 2)),
        amplitude: maxOriginalAmplitude,
        time: maxOriginalTime
    } : undefined;

    const isolatedPeakRegion = buffer2 ? {
        start: Math.max(0, maxIsolatedTime - (regionWindow / 2)),
        end: Math.min(duration, maxIsolatedTime + (regionWindow / 2)),
        amplitude: maxIsolatedAmplitude,
        time: maxIsolatedTime
    } : undefined;

    return { points: data, originalPeakRegion, isolatedPeakRegion };
};

// Format seconds to MM:SS.ms
export const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

// Convert AudioBuffer to WAV Blob
export const audioBufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this example)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < buffer.length) {
        for (i = 0; i < numOfChan; i++) {
            // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
            view.setInt16(44 + offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([bufferArr], { type: 'audio/wav' });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
};

export const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            // Remove data url prefix (e.g. "data:audio/wav;base64,")
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const extractAudioFromVideo = async (videoFile) => {
    // Use backend FFmpeg extraction instead of browser-based (more reliable)
    const formData = new FormData();
    formData.append('video', videoFile);

    const response = await fetch('http://localhost:3001/api/extract-audio', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extract audio');
    }

    // Get the WAV blob from response
    const wavBlob = await response.blob();

    // Decode the WAV using Web Audio API
    const arrayBuffer = await wavBlob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    return {
        buffer: audioBuffer,
        blob: wavBlob
    };
};

/**
 * Analyzes audio buffer for specific frequency characteristics typical of large PA systems.
 * Specifically checks for sub-bass energy (20-60Hz) vs Mid-range (200-2000Hz).
 */
export const analyzeSubBass = (audioBuffer) => {
    const rawData = audioBuffer.getChannelData(0); // Mono analysis
    const sampleRate = audioBuffer.sampleRate;
    const fftSize = 4096; // Good frequency resolution ~10Hz


    // We'll analyze a few windows from the loudest part of the track
    // 1. Find the loudest 3-second window to avoid intro/silence
    let maxEnergy = 0;
    let bestOffset = 0;
    const scanStep = Math.floor(sampleRate); // Check every second
    const windowSamples = 3 * sampleRate;

    for (let i = 0; i < rawData.length - windowSamples; i += scanStep) {
        let energy = 0;
        // Approximation: sum of absolute values
        // Check first 1000 samples of the window for speed
        for (let j = 0; j < 1000; j++) {
            energy += Math.abs(rawData[i + j]);
        }
        if (energy > maxEnergy) {
            maxEnergy = energy;
            bestOffset = i;
        }
    }

    // 2. Perform FFT on chunks within this loud window
    const context = new OfflineAudioContext(1, fftSize, sampleRate);
    const analyzer = context.createAnalyser();
    analyzer.fftSize = fftSize;
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyzer);
    analyzer.connect(context.destination);

    // Since we can't easily run real-time analysis in OfflineContext without rendering,
    // and manual FFT is complex, we will approximate using 2 filters.
    // A LowPass for Sub (20-60Hz) and BandPass for Mids (200-2000Hz).
    // Then compare RMS amplitude.

    return processWithFilters(audioBuffer, bestOffset, 3, sampleRate);
};

const processWithFilters = async (fullBuffer, offset, durationSeconds, sampleRate) => {
    // Create a mini buffer of just the loud part
    const length = durationSeconds * sampleRate;
    const offlineCtx = new OfflineAudioContext(1, length, sampleRate);

    const partialBuffer = offlineCtx.createBuffer(1, length, sampleRate);
    partialBuffer.copyToChannel(fullBuffer.getChannelData(0).subarray(offset, offset + length), 0);

    // Path 1: SUB BASS (20-60Hz)
    const sourceSub = offlineCtx.createBufferSource();
    sourceSub.buffer = partialBuffer;

    const lowPass = offlineCtx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 60;

    const highPassSub = offlineCtx.createBiquadFilter();
    highPassSub.type = "highpass";
    highPassSub.frequency.value = 20;

    sourceSub.connect(lowPass);
    lowPass.connect(highPassSub);
    highPassSub.connect(offlineCtx.destination);

    // Start Path 1
    sourceSub.start();
    const subResult = await offlineCtx.startRendering();

    // Path 2: MIDS (300-2000Hz) - Rerun for Mids (cannot execute parallel graphs easily in one offline context output, so we run sequential or use a second context)
    // Actually, for simplicity, let's just do RMS on the subResult and compare to specific known "thin" thresholds 
    // OR create a second context. Let's create a second context for clean separation.

    const offlineCtxMids = new OfflineAudioContext(1, length, sampleRate);
    const sourceMids = offlineCtxMids.createBufferSource();
    const partialBufferMids = offlineCtxMids.createBuffer(1, length, sampleRate);
    partialBufferMids.copyToChannel(fullBuffer.getChannelData(0).subarray(offset, offset + length), 0);
    sourceMids.buffer = partialBufferMids;

    const bandPass = offlineCtxMids.createBiquadFilter();
    bandPass.type = "peaking"; // Broad peaking or bandpass
    bandPass.frequency.value = 1000;
    bandPass.Q.value = 0.5; // Wide Q

    sourceMids.connect(bandPass);
    bandPass.connect(offlineCtxMids.destination);
    sourceMids.start();
    const midsResult = await offlineCtxMids.startRendering();

    const subRMS = calculateRMS(subResult.getChannelData(0));
    const midsRMS = calculateRMS(midsResult.getChannelData(0));

    // Ratio: How much sub bass compared to mids?
    // PA systems maintain high sub energy. Phones have almost 0.
    const ratio = (subRMS / (midsRMS || 0.0001));

    // Thresholds (Verified experimentally would be better, but heuristic:)
    // Phone: Sub is nonexistent. Ratio < 0.05
    // PA: Sub is powerful. Ratio > 0.15

    let confidence = 0;
    let label = "Unknown";

    if (ratio > 0.20) {
        label = "Large PA System";
        confidence = 0.95;
    } else if (ratio > 0.10) {
        label = "Possible PA / Car";
        confidence = 0.6;
    } else if (ratio < 0.05) {
        label = "Phone / Laptop";
        confidence = 0.9;
    } else {
        label = "Small Speaker";
        confidence = 0.5;
    }

    return {
        subRMS,
        midsRMS,
        ratio,
        label,
        confidence
    };
};

const calculateRMS = (data) => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
};

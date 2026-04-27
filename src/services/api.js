import { API_BASE_URL, PYTHON_API_BASE_URL } from './config';

const parseJsonOrThrow = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || 'Request failed');
    }
    return payload;
};

const toSongResult = (result) => ({
    title: result.title,
    artist: result.artist,
    label: result.label,
    rightsOrg: result.rights_org || result.pro || null,
    rightsText: result.rights_text || null,
    cover: result.cover,
    album: result.album
});

export const identifySong = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
        const response = await fetch(`${API_BASE_URL}/api/identify`, {
            method: 'POST',
            body: formData,
        });

        const result = await parseJsonOrThrow(response);
        return toSongResult(result);

    } catch (error) {
        console.error('Identification failed:', error);
        throw error;
    }
};

// Lyrics-based identification (fallback)
export const identifyByLyrics = async (lyricsText) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/identify-lyrics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lyrics: lyricsText }),
        });

        const result = await parseJsonOrThrow(response);
        return toSongResult(result);

    } catch (error) {
        console.error('Lyrics search failed:', error);
        throw error;
    }
};

export const requestForensicReport = async ({ audioBlob, peakTime, frameDataUrl = null, mode = 'detail' }) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'forensic-snippet.wav');
    formData.append('peak_time', String(peakTime || 0));
    formData.append('mode', mode);
    if (frameDataUrl) {
        formData.append('frame_data_url', frameDataUrl);
    }

    const response = await fetch(`${API_BASE_URL}/api/forensic-report`, {
        method: 'POST',
        body: formData
    });

    const result = await parseJsonOrThrow(response);
    return result.report;
};

export const getSystemHealth = async () => {
    const fetchHealth = async (url) => {
        const response = await fetch(url);
        return parseJsonOrThrow(response);
    };

    const [api, pythonAi] = await Promise.allSettled([
        fetchHealth(`${API_BASE_URL}/health`),
        fetchHealth(`${PYTHON_API_BASE_URL}/health`)
    ]);

    return {
        api: api.status === 'fulfilled'
            ? { reachable: true, ...api.value }
            : { reachable: false, error: api.reason?.message || 'API health request failed' },
        pythonAi: pythonAi.status === 'fulfilled'
            ? { reachable: true, ...pythonAi.value }
            : { reachable: false, error: pythonAi.reason?.message || 'Python AI health request failed' }
    };
};

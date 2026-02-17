// ACRCloud Music Recognition via Backend Server
// The backend server handles ACRCloud API authentication securely

export const identifySong = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
        const response = await fetch('http://localhost:3001/api/identify', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to identify song');
        }

        const result = await response.json();

        return {
            title: result.title,
            artist: result.artist,
            label: result.label,
            pro: result.pro,
            cover: result.cover,
            album: result.album
        };

    } catch (error) {
        console.error('Identification failed:', error);
        throw error;
    }
};

// Lyrics-based identification (fallback)
export const identifyByLyrics = async (lyricsText) => {
    try {
        const response = await fetch('http://localhost:3001/api/identify-lyrics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lyrics: lyricsText }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to find song by lyrics');
        }

        const result = await response.json();

        return {
            title: result.title,
            artist: result.artist,
            label: result.label || 'Unknown Label',
            pro: result.pro,
            cover: result.cover,
            album: result.album
        };

    } catch (error) {
        console.error('Lyrics search failed:', error);
        throw error;
    }
};

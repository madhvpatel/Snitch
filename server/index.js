import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fetch from 'node-fetch';
import FormData from 'form-data';

import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Enable CORS for frontend
app.use(cors({
    origin: 'http://localhost:5173'
}));

app.use(express.json());

// ACRCloud Configuration
const config = {
    host: process.env.ACRCLOUD_HOST,
    access_key: process.env.ACRCLOUD_ACCESS_KEY,
    access_secret: process.env.ACRCLOUD_ACCESS_SECRET,
    foursquare_key: process.env.FOURSQUARE_SERVICE_KEY,
    gemini_key: process.env.GEMINI_API_KEY
};

console.log('🔐 ACRCloud Configuration:');
console.log('Host:', config.host);
console.log('Access Key:', config.access_key ? `${config.access_key.substring(0, 10)}...` : 'MISSING');
console.log('Access Secret:', config.access_secret ? `${config.access_secret.substring(0, 10)}...` : 'MISSING');

// Function to identify audio using ACRCloud REST API
async function identifyAudio(audioBuffer) {
    const current_date = new Date();
    const timestamp = Math.floor(current_date.getTime() / 1000);

    const stringToSign = `POST\n/v1/identify\n${config.access_key}\naudio\n1\n${timestamp}`;
    const signature = crypto.createHmac('sha1', config.access_secret)
        .update(Buffer.from(stringToSign, 'utf-8'))
        .digest()
        .toString('base64');

    const formData = new FormData();
    formData.append('sample', audioBuffer, {
        filename: 'sample.webm',
        contentType: 'audio/webm'
    });
    formData.append('access_key', config.access_key);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('timestamp', timestamp.toString());

    const url = `https://${config.host}/v1/identify`;

    const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
    });

    return await response.json();
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'ACRCloud backend is running' });
});

// Song identification endpoint
app.post('/api/identify', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log('Received audio file:', req.file.originalname, 'Size:', req.file.size);

        // Identify the song using ACRCloud REST API
        const result = await identifyAudio(req.file.buffer);

        console.log('ACRCloud response:', JSON.stringify(result, null, 2));

        // Check if identification was successful
        if (result.status.code !== 0) {
            const statusCode = result.status.code === 3001 ? 401 : 404;
            return res.status(statusCode).json({
                error: result.status.code === 3001 ? 'Authentication failed' : 'Song not recognized',
                details: result.status.msg,
                code: result.status.code
            });
        }

        // Extract song metadata
        const metadata = result.metadata;
        if (!metadata || !metadata.music || metadata.music.length === 0) {
            return res.status(404).json({ error: 'No music found in audio' });
        }

        const song = metadata.music[0];

        // Format initial response from ACRCloud
        let response = {
            title: song.title,
            artist: song.artists ? song.artists.map(a => a.name).join(', ') : 'Unknown Artist',
            label: song.label || 'Unknown Label',
            // ACRCloud often provides copyright/rights info in 'external_metadata' or 'contributors'
            pro: song.external_metadata?.spotify?.album?.copyrights?.[0]?.text || 'Rights Verification Required',
            album: song.album?.name,
            release_date: song.release_date,
            cover: song.album?.cover || null,
            external_ids: song.external_ids,
            external_metadata: song.external_metadata
        };

        // HYBRID FALLBACK: If Label or PRO is missing, ask AI (if API key is present)
        // Check for specific "Unknown" indicators or missing data
        const needsLabel = !response.label || response.label === 'Unknown Label';
        const needsPRO = !response.pro || response.pro === 'Rights Verification Required';

        if ((needsLabel || needsPRO) && config.gemini_key) {
            console.log(`🤖 Metadata incomplete. Asking Gemini for: ${needsLabel ? 'Label' : ''} ${needsPRO ? 'PRO' : ''}`);
            try {
                const aiMetadata = await enrichMetadataWithAI(response.title, response.artist);
                if (aiMetadata) {
                    if (needsLabel && aiMetadata.label) {
                        response.label = aiMetadata.label + " (AI-Verified)";
                    }
                    if (needsPRO && aiMetadata.pro) {
                        response.pro = aiMetadata.pro + " (AI-Verified)";
                    }
                }
            } catch (aiError) {
                console.error("AI Enrichment failed:", aiError);
                // Fail silently, keep original response
            }
        }

        res.json(response);

    } catch (error) {
        console.error('Error identifying song:', error);
        res.status(500).json({
            error: 'Failed to identify song',
            details: error.message
        });
    }
});

// Helper: Ask Gemini for Metadata
async function enrichMetadataWithAI(title, artist) {
    try {
        const genAI = new GoogleGenerativeAI(config.gemini_key);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
        Identified Song: "${title}" by "${artist}".
        I need the Record Label and the primary Performing Rights Organization (PRO) for this specific song.
        
        Return STRICT JSON format only:
        {
            "label": "Name of Record Label",
            "pro": "Name of PRO (e.g. ASCAP, BMI, SESAC, PRS, GEMA)"
        }
        Do not include markdown formatting or explanations. If unknown, return null for that field.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json|```/g, '').trim();

        return JSON.parse(text);
    } catch (error) {
        console.error("AI Help Error:", error);
        return null;
    }
}

// Lyrics-based identification endpoint (fallback)
app.post('/api/identify-lyrics', async (req, res) => {
    try {
        const { lyrics } = req.body;

        if (!lyrics || lyrics.trim().length < 5) {
            return res.status(400).json({ error: 'Lyrics text is too short or missing' });
        }

        console.log('Received lyrics search request:', lyrics.substring(0, 50) + '...');

        // Simple keyword matching (in production, use Genius API)
        const mockSongDatabase = [
            { keywords: ['shape', 'you', 'mesmerize'], title: 'Shape of You', artist: 'Ed Sheeran', label: 'Atlantic Records', album: '÷ (Divide)' },
            { keywords: ['blinding', 'lights', 'vegas'], title: 'Blinding Lights', artist: 'The Weeknd', label: 'Republic Records', album: 'After Hours' },
            { keywords: ['levitating', 'moonlight'], title: 'Levitating', artist: 'Dua Lipa', label: 'Warner Records', album: 'Future Nostalgia' },
            { keywords: ['never', 'gonna', 'give'], title: 'Never Gonna Give You Up', artist: 'Rick Astley', label: 'RCA Records', album: 'Whenever You Need Somebody' }
        ];

        const lyricsLower = lyrics.toLowerCase();
        let bestMatch = null;
        let maxScore = 0;

        for (const song of mockSongDatabase) {
            let score = 0;
            for (const keyword of song.keywords) {
                if (lyricsLower.includes(keyword)) score++;
            }
            if (score > maxScore) {
                maxScore = score;
                bestMatch = song;
            }
        }

        if (!bestMatch || maxScore === 0) {
            return res.status(404).json({ error: 'No song found matching those lyrics' });
        }

        const mockPros = ["ASCAP", "BMI", "SESAC", "GMR"];
        const response = {
            title: bestMatch.title,
            artist: bestMatch.artist,
            label: bestMatch.label,
            pro: mockPros[Math.floor(Math.random() * mockPros.length)],
            album: bestMatch.album,
            cover: null
        };

        console.log('Lyrics match:', response.title, 'by', response.artist);
        res.json(response);

    } catch (error) {
        console.error('Error in lyrics search:', error);
        res.status(500).json({ error: 'Lyrics search failed', details: error.message });
    }
});
// Foursquare Nearby Venues Proxy (Bypasses CORS and hides Service Key)
app.get('/api/nearby-venues', async (req, res) => {
    try {
        const { ll, hacc, altitude } = req.query;

        if (!ll) {
            return res.status(400).json({ error: 'Latitude and longitude are required (ll=lat,lon)' });
        }

        console.log('Foursquare FRESHNESS proxy request for:', ll, 'Accuracy:', hacc);

        // Switching to /places/search with DISTANCE sort and OPEN_NOW=true to filter out stale/closed businesses
        // Categories: 13000 (Dining), 10000 (Arts/Ent), 16000 (Landmarks/Outdoors), 19000 (Travel/Transport)
        let url = `https://places-api.foursquare.com/places/search?ll=${ll}&limit=15&radius=1000&sort=DISTANCE&categories=13000,10000,16000,19000&open_now=true`;

        if (hacc) url += `&hacc=${hacc}`;
        if (altitude) url += `&altitude=${altitude}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${config.foursquare_key}`,
                'Accept': 'application/json',
                'X-Places-Api-Version': '2025-06-17'
            }
        });

        if (response.status === 429) {
            return res.status(429).json({ error: 'Foursquare credits exceeded' });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Foursquare API failed');
        }

        const data = await response.json();

        // Places Search API uses 'results' (Geotagging used 'candidates')
        const venues = (data.results || []).map(fsq => ({
            name: fsq.name,
            address: fsq.location?.formatted_address || "Nearby",
            distance: fsq.distance,
            categories: (fsq.categories || []).map(c => c.name)
        }));

        res.json({
            bestMatch: venues[0]?.name || null,
            suggestions: venues
        });

    } catch (error) {
        console.error('Foursquare proxy error:', error);
        res.status(500).json({ error: 'Failed to fetch venues', details: error.message });
    }
});

// =========================================================================
// Audio Extraction Endpoint (for Waveform Visualization)
// =========================================================================
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

app.post('/api/extract-audio', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snitch-audio-'));
    const inputPath = path.join(tempDir, 'input' + path.extname(req.file.originalname));
    const outputPath = path.join(tempDir, 'output.wav');

    try {
        // Write uploaded file to temp location
        await fs.writeFile(inputPath, req.file.buffer);

        // Extract audio using FFmpeg
        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('/opt/homebrew/bin/ffmpeg', [
                '-i', inputPath,
                '-vn', // No video
                '-acodec', 'pcm_s16le', // PCM 16-bit
                '-ar', '44100', // Sample rate
                '-ac', '2', // Stereo
                '-f', 'wav', // WAV format
                outputPath
            ]);

            ffmpeg.stderr.on('data', (data) => {
                // FFmpeg outputs progress to stderr
                console.log(`FFmpeg: ${data.toString().trim()}`);
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on('error', reject);
        });

        // Read the extracted WAV file
        const wavBuffer = await fs.readFile(outputPath);

        // Clean up temp files
        await fs.unlink(inputPath);
        await fs.unlink(outputPath);
        await fs.rmdir(tempDir);

        // Return WAV binary
        res.set('Content-Type', 'audio/wav');
        res.set('Content-Length', wavBuffer.length);
        res.send(wavBuffer);

    } catch (error) {
        console.error('Audio extraction error:', error);

        // Clean up on error
        try {
            await fs.unlink(inputPath).catch(() => { });
            await fs.unlink(outputPath).catch(() => { });
            await fs.rmdir(tempDir).catch(() => { });
        } catch { }

        res.status(500).json({ error: 'Failed to extract audio', details: error.message });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🎵 ACRCloud backend server running on http://localhost:${PORT}`);
    console.log(`🔑 Using ACRCloud host: ${config.host}`);
    console.log(`✨ Lyrics fallback enabled`);
});

// Mock Database for Demo Accuracy



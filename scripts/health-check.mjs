import process from 'node:process';

const apiBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
const pythonBaseUrl = process.env.VITE_PYTHON_API_BASE_URL || 'http://localhost:5001';

const readJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }

    return response.json();
};

const printStatus = (label, ok, detail) => {
    const prefix = ok ? 'OK' : 'FAIL';
    console.log(`${prefix.padEnd(5)} ${label}: ${detail}`);
};

const main = async () => {
    let failed = false;

    try {
        const apiHealth = await readJson(`${apiBaseUrl}/health`);
        printStatus('Node API', true, apiHealth.message);
        printStatus('ACRCloud config', apiHealth.services.acrcloud.configured, apiHealth.services.acrcloud.configured ? 'configured' : 'missing');
        printStatus('Google Places', apiHealth.services.google_places.configured, apiHealth.services.google_places.configured ? 'configured' : 'optional');
        printStatus('Local storage', apiHealth.services.storage.configured, apiHealth.services.storage.mode || 'unknown');
        printStatus('Portal auth', apiHealth.services.auth.configured, apiHealth.services.auth.mode || 'unknown');
        printStatus('FFmpeg', apiHealth.services.ffmpeg.available, apiHealth.services.ffmpeg.available ? apiHealth.services.ffmpeg.version : apiHealth.services.ffmpeg.error);
        printStatus('Gemini config', apiHealth.services.gemini.configured, apiHealth.services.gemini.configured ? 'configured' : 'optional');
        if (!apiHealth.services.acrcloud.configured || !apiHealth.services.ffmpeg.available) {
            failed = true;
        }
    } catch (error) {
        failed = true;
        printStatus('Node API', false, error.message);
    }

    try {
        const pythonHealth = await readJson(`${pythonBaseUrl}/health`);
        const detail = pythonHealth.model_loaded
            ? `${pythonHealth.model} on ${pythonHealth.device}`
            : `${pythonHealth.model} failed to load`;
        printStatus('Python AI', pythonHealth.model_loaded, detail);
        if (!pythonHealth.model_loaded) {
            failed = true;
        }
    } catch (error) {
        failed = true;
        printStatus('Python AI', false, error.message);
    }

    if (failed) {
        process.exit(1);
    }
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

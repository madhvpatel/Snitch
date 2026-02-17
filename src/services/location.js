// src/services/location.js
/**
 * Pure browser-based location service – NO external APIs
 * Returns raw coordinates + metadata for strong proof
 */

export const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,               // Reduced to 10s for the first attempt to fail fast to low accuracy
            maximumAge: 10000             // Allow using a fix from the last 10 seconds (useful if Maps just ran)
        };

        const onSuccess = (position) => {
            const { coords, timestamp } = position;

            const locationData = {
                lat: coords.latitude,
                lon: coords.longitude,
                accuracy: Math.round(coords.accuracy), // meters
                altitude: coords.altitude ? Math.round(coords.altitude) : null,
                altitudeAccuracy: coords.altitudeAccuracy,
                heading: coords.heading,
                speed: coords.speed,
                timestamp,
                obtainedAt: new Date(timestamp).toISOString(),
                // Simple source guess
                source:
                    coords.accuracy <= 30 ? "gps" :
                        coords.accuracy <= 150 ? "wifi" :
                            "cell"
            };

            resolve(locationData);
        };

        const onError = (err) => {
            // If high-accuracy timed out → try low-accuracy once
            if (options.enableHighAccuracy && (err.code === 3 || err.code === 2)) {
                console.warn("High-accuracy timed out. Retrying with low accuracy...");
                options.enableHighAccuracy = false;
                navigator.geolocation.getCurrentPosition(onSuccess, reject, options);
            } else {
                reject(err);
            }
        };

        navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    });
};

/**
 * Very basic caching – last good location (30 min validity)
 * Returns null if cache is stale or missing
 */
export const getCachedLocation = () => {
    try {
        const cached = localStorage.getItem("snitch_last_location");
        if (!cached) return null;

        const data = JSON.parse(cached);
        const ageMinutes = (Date.now() - data.timestamp) / 1000 / 60;

        if (ageMinutes > 30 || data.accuracy > 100) {
            localStorage.removeItem("snitch_last_location");
            return null;
        }

        return data;
    } catch {
        return null;
    }
};

export const saveLocationToCache = (locationData) => {
    if (locationData.accuracy <= 150) { // only cache reasonably accurate positions
        localStorage.setItem("snitch_last_location", JSON.stringify(locationData));
    }
};

/**
 * Foursquare Venue Search – Proxied through our backend to avoid CORS
 */
export const getFoursquareVenues = async (lat, lon, accuracy, altitude) => {
    try {
        let url = `http://localhost:3001/api/nearby-venues?ll=${lat},${lon}`;

        if (accuracy) url += `&hacc=${accuracy}`;
        if (altitude) url += `&altitude=${altitude}`;

        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch venues');
        }

        return await response.json();
    } catch (error) {
        console.error("Foursquare lookup failed:", error);
        return { bestMatch: null, suggestions: [] };
    }
};

/**
 * Generate tamper-evident proof hash
 */
export const generateLocationProofHash = async (locationData) => {
    const payload = `${locationData.lat.toFixed(6)},${locationData.lon.toFixed(6)},${locationData.accuracy},${locationData.timestamp}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

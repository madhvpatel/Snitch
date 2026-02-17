import React, { useState } from 'react';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import LicenseUploader from './components/LicenseUploader';
import LocationPrompt from './components/LocationPrompt';
import { MediaComparator } from './components/Forensics/MediaComparator';
import { VideoUploader } from './components/VideoUploader';
import { ResultDashboard } from './components/ResultDashboard';
import { identifySong } from './services/api';
import { getCurrentLocation, generateLocationProofHash, getFoursquareVenues } from './services/location';
import { extractAudioFromVideo, analyzeSubBass } from './services/audioUtils';

function App() {
  const [viewState, setViewState] = useState('upload'); // 'upload', 'processing', 'results', 'forensics'

  // Data State
  const [videoFile, setVideoFile] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);

  // Analysis Results
  const [song, setSong] = useState(null);
  const [locationProof, setLocationProof] = useState(null); // { data, hash, venue }
  const [permissions, setPermissions] = useState({ status: 'idle', licenses: [] });
  const [forensicReport, setForensicReport] = useState(null);
  const [speakerAuth, setSpeakerAuth] = useState(null);

  // Transient State
  const [confirmedVenue, setConfirmedVenue] = useState(null);
  const [venueOptions, setVenueOptions] = useState(null); // { bestMatch, suggestions }

  const handleVideoUpload = async (file) => {
    setVideoFile(file);
    setViewState('processing');
    setSong(null);
    setForensicReport(null);
    setLocationProof(null);
    setConfirmedVenue(null);
    setVenueOptions(null);

    try {
      // 1. Extract Audio (Optional - for waveform visualization)
      let buffer = null;
      let blob = null;

      try {
        const extraction = await extractAudioFromVideo(file);
        buffer = extraction.buffer;
        blob = extraction.blob;
        setAudioBlob(blob);
      } catch (audioError) {
        console.warn("Audio extraction failed (waveform unavailable):", audioError);
        // Continue without waveform - other features still work
      }

      // 2. Parallel Analysis Trigger
      // We don't await usage of result here immediately to allow some UI updates if we wanted,
      // but for simplicity we'll await all major data fetches.

      const songPromise = identifySong(blob || file).catch(err => {
        console.error("Song ID Failed", err);
        return null;
      });

      const locationPromise = getCurrentLocation().then(async (loc) => {
        const hash = await generateLocationProofHash(loc);
        const fsq = await getFoursquareVenues(loc.lat, loc.lon, loc.accuracy, loc.altitude);
        return { loc, hash, fsq };
      }).catch(err => {
        console.error("Location Failed", err);
        return null;
      });

      const forensicPromise = buffer ? generateForensicReport(buffer).catch(err => {
        console.error("Forensics Failed", err);
        return "Analysis Unavailable";
      }) : Promise.resolve("Waveform analysis unavailable");

      // Wait for everything
      const [songResult, locResult, forensicResult, speakerAuthResult] = await Promise.all([
        songPromise,
        locationPromise,
        forensicPromise,
        buffer ? analyzeSubBass(buffer).catch(err => {
          console.error("SubBass Analysis Failed", err);
          return null;
        }) : Promise.resolve(null)
      ]);

      setSong(songResult);
      setForensicReport(forensicResult);
      setSpeakerAuth(speakerAuthResult);

      if (locResult) {
        setLocationProof({ data: locResult.loc, hash: locResult.hash });
        setVenueOptions(locResult.fsq);
      }

      // Check licenses immediately if we have both
      if (songResult) {
        checkLicense(songResult, permissions.licenses);
      }

      setViewState('results');

    } catch (error) {
      console.error("Critical flow error", error);
      alert("An error occurred processing your video. See console.");
      setViewState('upload');
    }
  };

  const generateForensicReport = async (buffer) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return "API Key Missing";

    // Create short snippet for AI
    const snippetDuration = Math.min(30, buffer.duration);
    const offlineCtx = new OfflineAudioContext(1, 16000 * snippetDuration, 16000);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();

    await offlineCtx.startRendering();

    // Placeholder for now
    return "Click 'Detailed Forensic Lab' to generate full AI report.";
  };

  const checkLicense = (currentSong, licenses) => {
    if (!currentSong) return;
    const isLicensed = licenses.includes(currentSong.pro);
    setPermissions(prev => ({
      ...prev,
      status: isLicensed ? 'licensed' : 'unlicensed'
    }));
  };

  const handleLicenseVerified = (licenseData) => {
    const newLicenses = [...new Set([...permissions.licenses, ...licenseData.pros])];
    setPermissions({ status: 'idle', licenses: newLicenses }); // Re-check happens in effect or next render if needed
    if (song) checkLicense(song, newLicenses);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-8 font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">Snitch</h1>
        <p className="text-gray-400 text-lg">Video-First Forensic Verification</p>
      </header>

      {/* Main Content Area */}
      <div className="w-full max-w-6xl flex justify-center">

        {viewState === 'upload' && (
          <VideoUploader
            onVideoUpload={handleVideoUpload}
            isProcessing={false}
          />
        )}

        {viewState === 'processing' && (
          <VideoUploader
            onVideoUpload={() => { }}
            isProcessing={true}
          />
        )}

        {viewState === 'results' && (
          <div className="w-full flex flex-col items-center gap-8">
            {/* Location Prompt if ambiguous */}
            {!confirmedVenue && venueOptions && (
              <div className="w-full max-w-2xl">
                <LocationPrompt
                  locationData={locationProof?.data}
                  proofHash={locationProof?.hash}
                  bestMatch={venueOptions.bestMatch}
                  suggestions={venueOptions.suggestions}
                  onConfirm={(name) => {
                    setConfirmedVenue(name);
                    setLocationProof(prev => ({ ...prev, venue: name }));
                  }}
                />
              </div>
            )}

            {/* Dashboard */}
            {(confirmedVenue || !venueOptions) && (
              <ResultDashboard
                song={song}
                location={{ ...locationProof, venue: confirmedVenue }}
                forensicReport={forensicReport}
                permissions={permissions}
                requestForensics={() => setViewState('forensics')}
                speakerAuth={speakerAuth}
              />
            )}

            <button
              onClick={() => setViewState('upload')}
              className="mt-8 text-gray-500 hover:text-white flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Upload Another Video
            </button>
          </div>
        )}

        {viewState === 'forensics' && (
          <div className="w-full flex flex-col items-center">
            <MediaComparator
              audioBlob={audioBlob}
              videoFile={videoFile}
              onReset={() => setViewState('results')}
            />
          </div>
        )}

      </div>

      {/* Global License Manager (Bottom Right or simplified) */}
      <div className="fixed bottom-8 right-8">
        <LicenseUploader onLicenseVerified={handleLicenseVerified} />
      </div>
    </div>
  );
}

export default App;

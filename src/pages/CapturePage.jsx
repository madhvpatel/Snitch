import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Clock3, MapPinned, Mic, RefreshCcw, ShieldCheck, Video } from 'lucide-react';

import {
  createCaptureSession,
  createCaptureSubmission,
  finalizeCaptureSubmission,
  getCaptureSubmissionStatus,
  registerAnonymousInstall,
  retryCaptureSubmission,
  startCaptureSession,
  syncCaptureClock,
  uploadCaptureVideo,
} from '../services/platformApi';
import {
  buildDeviceTraits,
  collectDeviceSnapshot,
  getOrCreateInstallIdentity,
  getPreferredRecorderMimeType,
  signInstallPayload,
} from '../services/installIdentity';

const DEFAULT_POLICY = {
  minSeconds: 15,
  maxSeconds: 20,
};
const INVITE_CODE_STORAGE_KEY = 'snitch.capture.invite_code';
const SOURCE_CLASSIFIER_OPTIONS = [
  { value: 'source-v1', label: 'Stable v1' },
  { value: 'source-v2-fft', label: 'Experimental FFT' },
];

const formatSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
const formatInr = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const digestSha256 = async (blob) => {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const toGeoPoint = (position) => ({
  lat: position.coords.latitude,
  lon: position.coords.longitude,
  accuracy: position.coords.accuracy,
  altitude: position.coords.altitude,
  heading: position.coords.heading,
  speed: position.coords.speed,
  capturedAt: new Date(position.timestamp).toISOString(),
});

const getCurrentPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Geolocation is not supported'));
    return;
  }

  const lowAccuracyOptions = {
    enableHighAccuracy: false,
    timeout: 15000,
    maximumAge: 15000,
  };

  navigator.geolocation.getCurrentPosition(
    (position) => resolve(toGeoPoint(position)),
    (error) => {
      if (error?.code === 2 || error?.code === 3) {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(toGeoPoint(position)),
          reject,
          lowAccuracyOptions,
        );
        return;
      }
      reject(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  );
});

// Tries high-accuracy first, falls back to low-accuracy, never throws.
const getCurrentPositionSoft = () => getCurrentPosition().catch(() => new Promise((resolve) => {
  navigator.geolocation.getCurrentPosition(
    (position) => resolve(toGeoPoint(position)),
    () => resolve(null),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 20000 },
  );
}));

const startGpsTrack = (onPoint) => {
  if (!navigator.geolocation) {
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => onPoint(toGeoPoint(position)),
    () => {},
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 2000 },
  );

  return () => navigator.geolocation.clearWatch(watchId);
};

const stopMediaStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const getMediaErrorMessage = (error) => {
  if (error?.code === 1 || error?.name === 'PermissionDeniedError' || error?.message === 'User denied Geolocation') {
    return 'Location access was denied. If no fresh browser prompt appeared, iPhone is likely using a cached site denial or the browser app itself lacks Location Services. Open the site over HTTPS in a normal tab, re-allow Location for this site, and on iPhone Chrome also check Settings > Chrome > Location.';
  }
  if (error?.code === 2) {
    return 'Location could not be determined on this device.';
  }
  if (error?.code === 3) {
    return 'Location request timed out. Move to an area with better signal and try again.';
  }
  if (error?.name === 'NotAllowedError') {
    return 'Camera and microphone access was denied.';
  }
  if (error?.name === 'NotFoundError') {
    return 'No compatible camera or microphone was found on this device.';
  }
  return error?.message || 'Unable to prepare live capture on this device.';
};

const getSecureContextErrorMessage = () => {
  const { origin, protocol, hostname } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const protocolLabel = protocol || 'unknown protocol';

  if (isLocalHost) {
    return `Live capture is blocked because this page is not running in a secure browser context. Current origin: ${origin} (${protocolLabel}). Reload the page in Safari or Chrome directly instead of an embedded in-app browser.`;
  }

  return `Live capture needs HTTPS. Current origin: ${origin} (${protocolLabel}). On iPhone this usually means the page was opened over plain HTTP, through a LAN IP, or inside an embedded browser instead of Safari/Chrome.`;
};

export const CapturePage = () => {
  const previewRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const startMetaRef = useRef(null);
  const pollingRef = useRef(null);
  const gpsTrackRef = useRef([]);
  const stopGpsWatchRef = useRef(null);

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [identitySummary, setIdentitySummary] = useState(null);
  const [installRegistration, setInstallRegistration] = useState(null);
  const [capturePolicy, setCapturePolicy] = useState(DEFAULT_POLICY);
  const [captureSession, setCaptureSession] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [permissionState, setPermissionState] = useState({
    media: 'idle',
    location: 'idle',
  });
  const [inviteCode, setInviteCode] = useState(() => window.localStorage.getItem(INVITE_CODE_STORAGE_KEY) || '');
  const [sourceClassifierMode, setSourceClassifierMode] = useState('source-v1');

  const canStop = elapsedMs >= capturePolicy.minSeconds * 1000;
  const autoStopCountdown = useMemo(() => Math.max(capturePolicy.maxSeconds * 1000 - elapsedMs, 0), [capturePolicy.maxSeconds, elapsedMs]);

  useEffect(() => () => {
    window.clearInterval(timerRef.current);
    window.clearInterval(pollingRef.current);
    stopMediaStream(streamRef.current);
    stopGpsWatchRef.current?.();
  }, []);

  useEffect(() => {
    if (previewRef.current && streamRef.current) {
      previewRef.current.srcObject = streamRef.current;
      previewRef.current.play?.().catch(() => {});
    }
  }, [phase]);

  useEffect(() => {
    if (!submission?.submissionId || !status || !['processing', 'uploaded'].includes(status.status)) {
      window.clearInterval(pollingRef.current);
      return undefined;
    }

    pollingRef.current = window.setInterval(async () => {
      try {
        const nextStatus = await getCaptureSubmissionStatus(submission.submissionId);
        setStatus(nextStatus);
        if (['ready', 'failed', 'rejected_abuse'].includes(nextStatus.status)) {
          window.clearInterval(pollingRef.current);
          setPhase(nextStatus.status === 'ready' ? 'complete' : 'error');
        }
      } catch (pollError) {
        setError(pollError.message);
        window.clearInterval(pollingRef.current);
      }
    }, 2500);

    return () => {
      window.clearInterval(pollingRef.current);
    };
  }, [status, submission?.submissionId]);

  const prepareDevice = async () => {
    setError(null);
    setPhase('preparing');

    let preparedStream = null;

    try {
      if (!window.isSecureContext) {
        throw new Error(getSecureContextErrorMessage());
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('This browser does not support MediaRecorder live capture.');
      }

      setPermissionState((current) => ({
        ...current,
        location: 'requesting',
      }));

      // Kick off location immediately from the user gesture before any slower async work.
      const geolocationPromise = getCurrentPosition();
      const identity = await getOrCreateInstallIdentity();
      const traits = buildDeviceTraits();
      const registration = await registerAnonymousInstall({
        installId: identity.installId,
        publicKey: identity.publicKey,
        deviceTraits: traits,
        appVersion: 'snitch-web-v1',
        inviteCode: inviteCode.trim() || undefined,
      });
      if (inviteCode.trim()) {
        window.localStorage.setItem(INVITE_CODE_STORAGE_KEY, inviteCode.trim());
      } else {
        window.localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
      }

      stopMediaStream(streamRef.current);
      const geolocation = await geolocationPromise;

      preparedStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      setPermissionState((current) => ({
        ...current,
        media: 'granted',
      }));

      streamRef.current = preparedStream;
      setPermissionState({
        media: 'granted',
        location: 'granted',
      });
      setInstallRegistration(registration);
      setCapturePolicy(registration.capturePolicy || DEFAULT_POLICY);
      setIdentitySummary({
        installId: identity.installId,
        publicKey: identity.publicKey,
      });
      setCaptureSession({
        geolocationStart: geolocation,
      });
      setPhase('ready');
    } catch (prepareError) {
      if (preparedStream && streamRef.current !== preparedStream) {
        stopMediaStream(preparedStream);
      }
      setPermissionState((current) => ({
        media: prepareError?.name === 'NotAllowedError' || prepareError?.name === 'NotFoundError'
          ? 'denied'
          : current.media,
        location: prepareError?.code ? 'denied' : current.location,
      }));
      setError(getMediaErrorMessage(prepareError));
      setPhase('idle');
    }
  };

  const beginRecording = async () => {
    setError(null);

    try {
      setPermissionState((current) => ({
        ...current,
        location: current.location === 'granted' ? 'granted' : 'requesting',
      }));

      // Start the location request at the button tap so iPhone treats it as user-initiated.
      const geolocationStartPromise = getCurrentPosition();
      const identity = await getOrCreateInstallIdentity();
      const [sessionResponse, clockSync, geolocationStart, deviceSnapshot] = await Promise.all([
        createCaptureSession({ installId: identity.installId }),
        syncCaptureClock(),
        geolocationStartPromise,
        collectDeviceSnapshot(),
      ]);

      const startPayload = {
        captureSessionId: sessionResponse.captureSessionId,
        installId: identity.installId,
        localTime: new Date().toISOString(),
        measuredOffsetMs: clockSync.measuredOffsetMs,
        geolocation: geolocationStart,
        deviceSnapshot,
      };

      const sessionSignature = await signInstallPayload(identity, startPayload);
      await startCaptureSession(sessionResponse.captureSessionId, {
        ...startPayload,
        signature: sessionSignature,
      });

      const recorderMimeType = getPreferredRecorderMimeType();
      const submissionResponse = await createCaptureSubmission({
        captureSessionId: sessionResponse.captureSessionId,
        installId: identity.installId,
        mimeType: recorderMimeType || 'video/webm',
        fileName: `snitch-${Date.now()}.webm`,
        sourceClassifierMode,
      });

      // Start continuous GPS track — collect points every few seconds during recording.
      gpsTrackRef.current = geolocationStart ? [geolocationStart] : [];
      stopGpsWatchRef.current?.();
      stopGpsWatchRef.current = startGpsTrack((point) => {
        gpsTrackRef.current.push(point);
      });

      const recorder = new MediaRecorder(streamRef.current, recorderMimeType ? { mimeType: recorderMimeType } : undefined);
      chunksRef.current = [];
      recorderRef.current = recorder;
      startMetaRef.current = {
        localStartTime: startPayload.localTime,
        measuredStartOffsetMs: clockSync.measuredOffsetMs,
        captureSessionId: sessionResponse.captureSessionId,
        installId: identity.installId,
      };

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          // Stop GPS watch immediately so the last point is the true end location.
          stopGpsWatchRef.current?.();
          stopGpsWatchRef.current = null;

          setPhase('uploading');
          const localEndTime = new Date().toISOString();
          const videoBlob = new Blob(chunksRef.current, {
            type: recorder.mimeType || recorderMimeType || 'video/webm',
          });

          const durationSeconds = elapsedMs / 1000;
          if (durationSeconds < capturePolicy.minSeconds) {
            throw new Error(`Recording was discarded because it did not reach ${capturePolicy.minSeconds} seconds.`);
          }

          // Use soft end-position: retries with low-accuracy before giving up.
          const [mediaSha256, endClockSync, geolocationEnd] = await Promise.all([
            digestSha256(videoBlob),
            syncCaptureClock(),
            getCurrentPositionSoft(),
          ]);

          // Append end-geo as final track point if we got one and it differs from last.
          const gpsTrack = gpsTrackRef.current.slice();
          if (geolocationEnd) {
            const last = gpsTrack[gpsTrack.length - 1];
            if (!last || last.capturedAt !== geolocationEnd.capturedAt) {
              gpsTrack.push(geolocationEnd);
            }
          }

          const uploadResult = await uploadCaptureVideo({
            submissionId: submissionResponse.submissionId,
            uploadToken: submissionResponse.uploadToken,
            videoBlob,
            fileName: `snitch-${submissionResponse.reference}.webm`,
          });

          const finalizePayload = {
            captureSessionId: sessionResponse.captureSessionId,
            submissionId: submissionResponse.submissionId,
            installId: identity.installId,
            mediaSha256,
            localStartTime: startMetaRef.current.localStartTime,
            localEndTime,
            measuredStartOffsetMs: startMetaRef.current.measuredStartOffsetMs,
            measuredEndOffsetMs: endClockSync.measuredOffsetMs,
            durationSeconds,
            geolocationEnd,
            gpsTrack: gpsTrack.length >= 2 ? gpsTrack : undefined,
          };

          const finalizeSignature = await signInstallPayload(identity, {
            captureSessionId: finalizePayload.captureSessionId,
            submissionId: finalizePayload.submissionId,
            installId: finalizePayload.installId,
            mediaSha256: finalizePayload.mediaSha256,
            localEndTime: finalizePayload.localEndTime,
            measuredEndOffsetMs: finalizePayload.measuredEndOffsetMs,
            durationSeconds: finalizePayload.durationSeconds,
            geolocationEnd: finalizePayload.geolocationEnd,
          });

          const finalized = await finalizeCaptureSubmission(submissionResponse.submissionId, {
            ...finalizePayload,
            signature: finalizeSignature,
            uploadAssetId: uploadResult.assetId,
          });

          setSubmission(submissionResponse);
          setStatus(finalized);
          setPhase(finalized.status === 'processing' ? 'processing' : finalized.status === 'ready' ? 'complete' : 'error');
        } catch (stopError) {
          setError(stopError.message);
          setPhase('error');
        }
      };

      recorder.start(1000);
      setCaptureSession({
        captureSessionId: sessionResponse.captureSessionId,
        sessionNonce: sessionResponse.sessionNonce,
        geolocationStart,
        clockSync,
      });
      setSubmission(submissionResponse);
      setElapsedMs(0);
      setPhase('recording');

      const recordingStartAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const nextElapsed = Date.now() - recordingStartAt;
        setElapsedMs(nextElapsed);
        if (nextElapsed >= capturePolicy.maxSeconds * 1000) {
          window.clearInterval(timerRef.current);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }
      }, 100);
    } catch (recordError) {
      setError(getMediaErrorMessage(recordError));
      setPhase('ready');
    }
  };

  const stopRecording = () => {
    if (!canStop || recorderRef.current?.state !== 'recording') {
      return;
    }

    window.clearInterval(timerRef.current);
    recorderRef.current.stop();
  };

  const handleRetryProcessing = async () => {
    if (!submission?.submissionId) {
      return;
    }

    setIsRetrying(true);
    setError(null);

    try {
      const retried = await retryCaptureSubmission(submission.submissionId);
      setStatus((current) => ({
        ...(current || {}),
        ...retried,
        processingError: null,
        reportIds: current?.reportIds || [],
      }));
      setPhase('processing');
    } catch (retryError) {
      setError(retryError.message);
    } finally {
      setIsRetrying(false);
    }
  };

  const statusTone = status?.status === 'ready'
    ? 'text-emerald-200 border-emerald-400/20 bg-emerald-400/10'
    : status?.status === 'failed' || status?.status === 'rejected_abuse'
      ? 'text-rose-200 border-rose-400/20 bg-rose-400/10'
      : 'text-amber-100 border-amber-300/20 bg-amber-400/10';

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
      <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Live Recorder</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Capture a 15–20 second venue evidence clip.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              This route only accepts live in-browser recording. The app binds each session to an anonymous install,
              signs start and finalize payloads, and records clock skew against the backend.
            </p>
          </div>
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-50">
            <p className="font-semibold">Capture rules</p>
            <p className="mt-1 text-cyan-100/80">{capturePolicy.minSeconds}s minimum, auto-stop at {capturePolicy.maxSeconds}s, single continuous clip.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400"
              />
              <span>
                I understand that Snitch will capture camera, microphone, and location data, then retain the evidence package for enforcement review.
              </span>
            </div>
          </label>

          <div className="space-y-3">
            <label className="block rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Invite code</span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="DELHI-VERIFIED-2026"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
              />
              <p className="mt-2 text-xs text-slate-400">Invite-only contributors can earn staged rewards for first actionable proof on unlicensed venues.</p>
            </label>
            <label className="block rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">Source classifier mode</span>
              <select
                value={sourceClassifierMode}
                onChange={(event) => setSourceClassifierMode(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
              >
                {SOURCE_CLASSIFIER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-400">Use the stable classifier for baseline runs and the FFT mode for pre-prod A/B testing.</p>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Camera + Mic</p>
                <p className="mt-3 text-sm font-medium text-white">{permissionState.media}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Location</p>
                <p className="mt-3 text-sm font-medium text-white">{permissionState.location}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/80">
          <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.4),_rgba(15,23,42,0.95))]">
            {streamRef.current ? (
              <video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-slate-400">
                  <Video size={42} className="mx-auto mb-4 text-cyan-300" />
                  <p className="text-sm">Live preview appears here after device preparation.</p>
                </div>
              </div>
            )}

            {phase === 'recording' && (
              <div className="absolute left-4 top-4 rounded-full border border-rose-300/30 bg-rose-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-rose-100">
                Recording
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Clock3 size={16} className="text-cyan-200" />
                  Elapsed: {formatSeconds(elapsedMs)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={16} className="text-cyan-200" />
                  Stop unlocks at {capturePolicy.minSeconds}s
                </span>
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw size={16} className="text-cyan-200" />
                  Auto-stop in {formatSeconds(autoStopCountdown)}
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={prepareDevice}
                  disabled={!consentAccepted || ['preparing', 'recording', 'uploading', 'processing'].includes(phase)}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prepare Device
                </button>
                <button
                  type="button"
                  onClick={beginRecording}
                  disabled={phase !== 'ready'}
                  className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Live Capture
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={phase !== 'recording' || !canStop}
                  className="rounded-full border border-rose-300/30 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Stop Capture
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-3xl border border-rose-300/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        )}
      </section>

      <aside className="space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Evidence Chain</p>
          <div className="mt-5 space-y-4 text-sm text-slate-300">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Install ID</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-100">{identitySummary?.installId || 'Unregistered'}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Abuse State</p>
              <p className="mt-2 text-sm font-medium text-white">{installRegistration?.abuseState?.status || 'n/a'}</p>
              <p className="mt-1 text-xs text-slate-400">Score: {installRegistration?.abuseState?.score ?? 'n/a'}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Contributor Program</p>
              <p className="mt-2 text-sm font-medium text-white">{installRegistration?.rewardsProgram?.contributor?.displayName || 'Invite code not linked'}</p>
              <p className="mt-1 text-xs text-slate-400">
                {installRegistration?.rewardsProgram?.rewardsEligible
                  ? `${installRegistration.rewardsProgram.contributor.trustTierLabel} tier, cap ${formatInr(installRegistration.rewardsProgram.contributor.monthlyPayoutCapInr)}`
                  : 'Invite-only rewards remain locked until a valid code is linked.'}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Capture Session</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-100">{captureSession?.captureSessionId || 'Not started'}</p>
              <p className="mt-2 text-xs text-slate-400">Measured start skew: {captureSession?.clockSync ? `${Math.round(captureSession.clockSync.measuredOffsetMs)}ms` : 'n/a'}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Location Snapshot</p>
              <p className="mt-2 text-sm text-white">
                {captureSession?.geolocationStart
                  ? `${captureSession.geolocationStart.lat.toFixed(5)}, ${captureSession.geolocationStart.lon.toFixed(5)}`
                  : 'Pending'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Accuracy: {captureSession?.geolocationStart?.accuracy ? `${Math.round(captureSession.geolocationStart.accuracy)}m` : 'n/a'}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-[32px] border p-6 ${status ? statusTone : 'border-white/10 bg-slate-950/70 text-slate-200'}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em]">Submission Status</p>
          <p className="mt-4 text-2xl font-semibold">{status?.status || 'Idle'}</p>
          <div className="mt-4 space-y-2 text-sm">
            <p>Reference: {status?.reference || submission?.reference || 'n/a'}</p>
            <p>Clock skew flag: {status?.clockSkewFlag ? 'Flagged' : 'Clear'}</p>
            <p>Reports created: {status?.reportIds?.length || 0}</p>
            <p>Eligible cases: {status?.rewardSummary?.eligibleCases || 0}</p>
            <p>Estimated recoverable value: {status?.rewardSummary ? formatInr(status.rewardSummary.estimatedRecoverableValueInr) : 'n/a'}</p>
            <p>Rewards on hold: {status?.rewardSummary ? formatInr(status.rewardSummary.heldAmountInr) : 'n/a'}</p>
            {status?.processingError && <p>Error: {status.processingError}</p>}
          </div>
          {status?.cases?.length > 0 && (
            <div className="mt-5 space-y-3">
              {status.cases.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-white/10 bg-black/10 p-4 text-sm">
                  <p className="font-semibold text-white">{entry.reference}</p>
                  <p className="mt-1 text-slate-200">{entry.caseStatus} • {entry.licenseStatus}</p>
                  <p className="mt-1 text-slate-300">{entry.planningBand}</p>
                  <p className="mt-1 text-slate-300">Estimated value: {formatInr(entry.estimatedRecoverableValueInr)}</p>
                </div>
              ))}
            </div>
          )}
          {status?.status === 'failed' && submission?.submissionId && (
            <button
              type="button"
              onClick={handleRetryProcessing}
              disabled={isRetrying}
              className="mt-5 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRetrying ? 'Retrying...' : 'Retry Processing'}
            </button>
          )}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex items-center gap-3 text-cyan-100">
            <Camera size={16} />
            <Mic size={16} />
            <MapPinned size={16} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Wi-Fi and Bluetooth evidence are excluded from this browser-based recorder build. Rewards only apply when
            the venue is later verified as unlicensed or expired for the matched rights layer.
          </p>
        </div>
      </aside>
    </div>
  );
};

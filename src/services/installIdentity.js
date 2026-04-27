const STORAGE_KEY = 'snitch.install.identity.v1';

const arrayBufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

const canonicalizePayload = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizePayload(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizePayload(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
};

const createIdentityRecord = async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );

  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicSpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);

  const record = {
    installId: crypto.randomUUID(),
    publicKey: arrayBufferToBase64(publicSpki),
    privateJwk,
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return {
    ...record,
    privateKey: keyPair.privateKey,
  };
};

const hydrateIdentityRecord = async (record) => {
  if (!record?.privateJwk || !record?.publicKey || !record?.installId) {
    return createIdentityRecord();
  }

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    record.privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign'],
  );

  return {
    ...record,
    privateKey,
  };
};

export const getOrCreateInstallIdentity = async () => {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (!existing) {
    return createIdentityRecord();
  }

  try {
    return await hydrateIdentityRecord(JSON.parse(existing));
  } catch {
    return createIdentityRecord();
  }
};

export const signInstallPayload = async (identity, payload) => {
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.privateKey,
    new TextEncoder().encode(canonicalizePayload(payload)),
  );

  return arrayBufferToBase64(signature);
};

const pickPreferredMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || null;
};

export const buildDeviceTraits = () => ({
  platform: navigator.userAgentData?.platform || navigator.platform || 'unknown',
  browser: navigator.userAgent,
  screenClass: `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio || 1}`,
  locale: navigator.language || 'en-IN',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  mediaProfile: {
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    preferredMimeType: pickPreferredMimeType(),
  },
});

export const collectDeviceSnapshot = async () => {
  const base = buildDeviceTraits();
  const connection = navigator.connection
    ? {
        effectiveType: navigator.connection.effectiveType || null,
        downlink: navigator.connection.downlink || null,
        rtt: navigator.connection.rtt || null,
      }
    : null;

  let battery = null;
  if (navigator.getBattery) {
    try {
      const status = await navigator.getBattery();
      battery = {
        level: status.level,
        charging: status.charging,
      };
    } catch {
      battery = null;
    }
  }

  return {
    ...base,
    connection,
    battery,
    visibilityState: document.visibilityState,
  };
};

export const getPreferredRecorderMimeType = pickPreferredMimeType;

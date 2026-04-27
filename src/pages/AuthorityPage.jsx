import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  Bluetooth,
  Camera,
  CheckCircle2,
  Download,
  FileSearch,
  Fingerprint,
  Landmark,
  LogOut,
  MapPinned,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  PORTAL_TOKEN_STORAGE_KEY,
  createCasePacket,
  getDemoAccounts,
  getPortalDashboard,
  getPortalReports,
  getPortalSession,
  loginPortal,
} from '../services/platformApi';
import { AuthorityVenueMap } from '../components/platform/AuthorityVenueMap';

const DEFAULT_LOGIN_FORM = {
  email: 'admin@snitch.local',
  password: 'snitch-demo-2026',
  totpCode: '',
};

const SIDEBAR_TABS = [
  { key: 'queue', label: 'Queue' },
  { key: 'venues', label: 'Venues' },
  { key: 'songs', label: 'Songs' },
];

const MAIN_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'geo', label: 'Venue Map' },
  { key: 'packet', label: 'Packet' },
  { key: 'trail', label: 'Trail' },
];

const sortDemoAccounts = (accounts) => accounts
  .slice()
  .sort((left, right) => Number(Boolean(right.email === 'admin@snitch.local')) - Number(Boolean(left.email === 'admin@snitch.local')));

const QUALITY_META = {
  strong: {
    label: 'Prime',
    point: '#d7b667',
    fill: 'bg-[#d7b667]/15',
    border: 'border-[#d7b667]/35',
    text: 'text-[#f4deb2]',
  },
  good: {
    label: 'Stable',
    point: '#92a16d',
    fill: 'bg-[#92a16d]/16',
    border: 'border-[#92a16d]/35',
    text: 'text-[#d4ddb5]',
  },
  review: {
    label: 'Review',
    point: '#c97f3c',
    fill: 'bg-[#c97f3c]/16',
    border: 'border-[#c97f3c]/35',
    text: 'text-[#f0c89f]',
  },
  weak: {
    label: 'Fragile',
    point: '#ad5242',
    fill: 'bg-[#ad5242]/16',
    border: 'border-[#ad5242]/35',
    text: 'text-[#e8b7af]',
  },
};

const STATUS_META = {
  confirmed: 'text-[#d9e7bf] bg-[#92a16d]/18 border-[#92a16d]/35',
  rejected: 'text-[#ebb8b0] bg-[#ad5242]/18 border-[#ad5242]/35',
  unreviewed: 'text-[#f0dab2] bg-[#d7b667]/16 border-[#d7b667]/35',
  needs_manual_venue_match: 'text-[#f0c89f] bg-[#c97f3c]/16 border-[#c97f3c]/35',
};

const CHART_COLORS = ['#d7b667', '#92a16d', '#c97f3c', '#6d7f86', '#ad5242', '#c9c0a8'];
const IPRS_CASE_STAGE_META = {
  actionable: 'text-[#d9e7bf] bg-[#92a16d]/18 border-[#92a16d]/35',
  provisional: 'text-[#f0dab2] bg-[#d7b667]/16 border-[#d7b667]/35',
  rejected: 'text-[#ebb8b0] bg-[#ad5242]/18 border-[#ad5242]/35',
};
const IPRS_PRIORITY_META = {
  immediate_action: 'text-[#d9e7bf] bg-[#92a16d]/18 border-[#92a16d]/35',
  watchlist: 'text-[#f0dab2] bg-[#d7b667]/16 border-[#d7b667]/35',
  parked: 'text-[#bfc7ca] bg-[#6d7f86]/18 border-[#6d7f86]/35',
};
const IPRS_GATE_META = {
  pass: 'text-[#d9e7bf] bg-[#92a16d]/18 border-[#92a16d]/35',
  fail: 'text-[#ebb8b0] bg-[#ad5242]/18 border-[#ad5242]/35',
};
const APPLICATION_DISPOSITION_META = {
  attack_now: 'text-[#d9e7bf] bg-[#92a16d]/18 border-[#92a16d]/35',
  build_corroboration: 'text-[#f0dab2] bg-[#d7b667]/16 border-[#d7b667]/35',
  manual_review: 'text-[#d7dfe2] bg-[#6d7f86]/18 border-[#6d7f86]/35',
  do_not_pursue: 'text-[#ebb8b0] bg-[#ad5242]/18 border-[#ad5242]/35',
};

const loadSavedToken = () => window.localStorage.getItem(PORTAL_TOKEN_STORAGE_KEY) || '';

const compactNumber = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

const formatInr = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatPercent = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : 'n/a';
};

const formatDateTime = (value) => {
  if (!value) {
    return 'n/a';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'n/a';
  }

  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatShortDate = (value) => {
  if (!value) {
    return 'n/a';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'n/a';
  }

  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
};

const formatRelativeTime = (value) => {
  if (!value) {
    return 'n/a';
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'n/a';
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / (60 * 1000)));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 48) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatCoords = (point, precision = 4) => {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
    return 'Unlocated';
  }

  return `${point.lat.toFixed(precision)}, ${point.lon.toFixed(precision)}`;
};

const formatMaybeNumber = (value, digits = 2) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits).replace(/\.?0+$/, '') : 'n/a';
};

const formatMeters = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)} m` : 'n/a';
};

const humanizeToken = (value) => {
  if (!value) {
    return 'n/a';
  }

  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const PLAYBACK_CUE_PATTERNS = [
  /\bspeaker\b/i,
  /\bsoundbar\b/i,
  /\bpa system\b/i,
  /\bpublic address\b/i,
  /\bamplifier\b/i,
  /\bamp\b/i,
  /\bmixer\b/i,
  /\bconsole\b/i,
  /\bdj\b/i,
  /\bturntable\b/i,
  /\bmicrophone\b/i,
  /\bmic\b/i,
  /\bsubwoofer\b/i,
  /\bwoofer\b/i,
  /\breceiver\b/i,
  /\baudio rack\b/i,
  /\bsound system\b/i,
  /\bceiling speaker\b/i,
  /\bwall[- ]mounted speaker\b/i,
  /\bmonitor speaker\b/i,
];

const getVisualCueBuckets = (items) => {
  const playbackCues = [];
  const sceneObjects = [];
  const seen = new Set();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = String(item || '').trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    if (PLAYBACK_CUE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      playbackCues.push(normalized);
      return;
    }

    sceneObjects.push(normalized);
  });

  return { playbackCues, sceneObjects };
};

const resolveAssetUrl = (value) => {
  if (!value || typeof value !== 'string' || typeof window === 'undefined') {
    return value || null;
  }

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname.startsWith('/media/')) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return value;
  }

  return value;
};

const toBand = (score) => {
  if (score >= 82) {
    return 'strong';
  }
  if (score >= 68) {
    return 'good';
  }
  if (score >= 48) {
    return 'review';
  }
  return 'weak';
};

const average = (values) => {
  const numeric = values.filter((value) => Number.isFinite(value));
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null;
};

const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const parseMaybeJson = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getGeoSnapshots = (report) => {
  const capture = report?.evidencePackage?.captureIntegrity?.geolocation || {};
  const submission = report?.submission || {};
  return {
    start: submission.geolocationStart || capture.start || null,
    end: submission.geolocationEnd || capture.end || null,
  };
};

const derivePoint = (report) => {
  const { start, end } = getGeoSnapshots(report);
  if (end && Number.isFinite(Number(end.lat)) && Number.isFinite(Number(end.lon))) {
    return { lat: Number(end.lat), lon: Number(end.lon), source: 'capture_end' };
  }
  if (start && Number.isFinite(Number(start.lat)) && Number.isFinite(Number(start.lon))) {
    return { lat: Number(start.lat), lon: Number(start.lon), source: 'capture_start' };
  }

  const matchedVenue = report?.evidencePackage?.venueContext?.matchedVenue || report?.venue || null;
  if (matchedVenue && Number.isFinite(Number(matchedVenue.latitude)) && Number.isFinite(Number(matchedVenue.longitude))) {
    return {
      lat: Number(matchedVenue.latitude),
      lon: Number(matchedVenue.longitude),
      source: 'matched_venue',
    };
  }

  return null;
};

const calculateDistanceMeters = (start, end) => {
  if (!start || !end) {
    return null;
  }

  const lat1 = Number(start.lat);
  const lon1 = Number(start.lon);
  const lat2 = Number(end.lat);
  const lon2 = Number(end.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return null;
  }

  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(lat2 - lat1);
  const lonDelta = toRadians(lon2 - lon1);
  const a = (
    Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lonDelta / 2) ** 2
  );
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const toVenueCoordPoint = (venue) => {
  if (!venue) {
    return null;
  }

  const lat = Number(venue.latitude ?? venue.lat);
  const lon = Number(venue.longitude ?? venue.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
};

const toContributorTrustScore = (contributor) => {
  const tier = String(contributor?.trustTierLabel || contributor?.trustTier || '').toLowerCase();
  if (tier.includes('elite') || tier.includes('tier 1') || tier.includes('high')) {
    return 1;
  }
  if (tier.includes('tier 2') || tier.includes('medium')) {
    return 0.75;
  }
  if (tier.includes('tier 3') || tier.includes('low')) {
    return 0.5;
  }
  if (tier.includes('probation') || tier.includes('new')) {
    return 0.3;
  }
  return 0.5;
};

const toVenueScaleScore = ({ merchant, matchedVenue }) => {
  let score = 0.2;
  const outletCount = Number(merchant?.outletCount || matchedVenue?.outletCount || 0);
  if (outletCount > 0) {
    score += Math.min(0.32, outletCount / 20);
  }

  if (merchant?.eventCapability || matchedVenue?.eventCapability) {
    score += 0.2;
  }

  const cityTier = String(merchant?.cityTier || matchedVenue?.cityTier || '').toLowerCase();
  if (cityTier.includes('tier 1')) {
    score += 0.18;
  } else if (cityTier.includes('tier 2')) {
    score += 0.12;
  }

  const venueType = String(merchant?.venueType || matchedVenue?.venueType || '').toLowerCase();
  if (/(club|lounge|bar|banquet|event|pub|dj)/.test(venueType)) {
    score += 0.18;
  } else if (venueType) {
    score += 0.08;
  }

  return clamp(score);
};

const buildIprsAssessment = ({
  capture,
  audio,
  source,
  visual,
  rights,
  reviewTrail,
  point,
  locationDelta,
  merchant,
  matchedVenue,
  selectedVenue,
  contributor,
  createdAt,
}) => {
  const venuePoint = toVenueCoordPoint(matchedVenue) || toVenueCoordPoint(selectedVenue);
  const measuredOffsets = capture?.measuredOffsetsMs || {};
  const maxClockOffsetMs = Math.max(
    Math.abs(Number(measuredOffsets.start || 0)),
    Math.abs(Number(measuredOffsets.end || 0)),
  );
  const geoVenueDistanceMeters = Number.isFinite(Number(locationDelta?.minVenueDistanceMeters))
    ? Number(locationDelta.minVenueDistanceMeters)
    : calculateDistanceMeters(point, venuePoint);
  const trustBand = String(capture?.device?.deviceTrustBand || '').toLowerCase();

  const integrityChecks = [
    {
      label: 'Payload signature',
      pass: Boolean(capture?.mediaSha256) && capture?.signatureStatus === 'signed_and_verified',
      detail: capture?.mediaSha256 ? humanizeToken(capture?.signatureStatus || 'missing') : 'Media hash or signature missing.',
    },
    {
      label: 'Clock skew',
      pass: capture?.clockSkewStatus !== 'flagged' && maxClockOffsetMs <= 30000,
      detail: Number.isFinite(maxClockOffsetMs) ? `${Math.round(maxClockOffsetMs)} ms observed` : humanizeToken(capture?.clockSkewStatus || 'unknown'),
    },
    {
      label: 'Venue geofence',
      pass: geoVenueDistanceMeters != null && geoVenueDistanceMeters <= 50,
      detail: geoVenueDistanceMeters != null ? `${Math.round(geoVenueDistanceMeters)} m from venue anchor` : 'Venue or capture coordinates unavailable.',
    },
    {
      label: 'Device trust band',
      pass: trustBand === 'high',
      detail: humanizeToken(trustBand || 'unknown'),
    },
  ];
  const integrityPass = integrityChecks.every((entry) => entry.pass);

  const playbackContext = String(visual?.playbackContext || '').toLowerCase();
  const playbackConfirmed = /(confirmed|public|speaker|pa|dj|venue)/.test(playbackContext) && !/(personal|phone|headphone|private)/.test(playbackContext);
  const sourceDeterministicScore = Number(source?.deterministicScore ?? source?.confidence ?? 0);
  const visualConfidence = Number(visual?.confidence || 0);
  const playbackCues = getVisualCueBuckets(visual?.visibleEquipment).playbackCues;
  const venueCueCount = (visual?.venueIdentitySignals || []).length;
  const obstructionCount = (visual?.obstructionFlags || []).length;
  const evidenceChecks = [
    {
      label: 'Audio identity',
      pass: Number(audio?.matchedTrackConfidence || 0) >= 0.85 && Boolean(audio?.isrc) && Boolean(audio?.upc),
      detail: `${Math.round(Number(audio?.matchedTrackConfidence || 0) * 100)}% confidence / ISRC ${audio?.isrc ? 'present' : 'missing'} / UPC ${audio?.upc ? 'present' : 'missing'}`,
    },
    {
      label: 'Source assessment',
      pass: sourceDeterministicScore >= 0.75,
      detail: `${Math.round(sourceDeterministicScore * 100)} / 100 deterministic score`,
    },
    {
      label: 'Visual corroboration',
      pass: playbackConfirmed
        && playbackCues.length > 0
        && venueCueCount > 0
        && obstructionCount === 0
        && visualConfidence >= 0.4,
      detail: `${humanizeToken(visual?.playbackContext || 'missing')} / ${playbackCues.length} playback cues / ${venueCueCount} venue cues / ${obstructionCount} obstructions`,
    },
  ];
  const evidencePass = evidenceChecks.every((entry) => entry.pass);

  const rightsOrgText = `${rights?.org?.name || ''} ${rights?.rightsOrgText || ''}`.trim();
  const rightsTypeText = String(rights?.rightsType || rights?.rightsTypeText || rights?.type || '').toLowerCase();
  const rightsChecks = [
    {
      label: 'IPRS ownership',
      pass: /\biprs\b/i.test(rightsOrgText),
      detail: rightsOrgText || 'Rights owner metadata missing.',
    },
    {
      label: 'Public performance rights',
      pass: rightsTypeText.includes('public') && rightsTypeText.includes('performance'),
      detail: rightsTypeText ? humanizeToken(rightsTypeText) : 'Rights type missing from payload.',
    },
    {
      label: 'ISRC present',
      pass: Boolean(audio?.isrc),
      detail: audio?.isrc || 'ISRC missing for repertoire cross-check.',
    },
  ];
  const rightsPass = rightsChecks.every((entry) => entry.pass);

  let caseStage = 'rejected';
  if (integrityPass && evidencePass && rightsPass) {
    caseStage = 'actionable';
  } else if (integrityPass && evidencePass) {
    caseStage = 'provisional';
  }

  const blockers = [
    ...integrityChecks.filter((entry) => !entry.pass).map((entry) => entry.label),
    ...evidenceChecks.filter((entry) => !entry.pass).map((entry) => entry.label),
    ...rightsChecks.filter((entry) => !entry.pass).map((entry) => entry.label),
  ];

  const recencyAgeDays = createdAt ? Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)) : 30;
  const evidenceStrength = clamp((
    (integrityPass ? 0.34 : integrityChecks.filter((entry) => entry.pass).length / (integrityChecks.length * 3))
    + (evidencePass ? 0.33 : evidenceChecks.filter((entry) => entry.pass).length / (evidenceChecks.length * 3))
    + (rightsPass ? 0.33 : rightsChecks.filter((entry) => entry.pass).length / (rightsChecks.length * 3))
  ));

  return {
    integrityPass,
    evidencePass,
    rightsPass,
    integrityChecks,
    evidenceChecks,
    rightsChecks,
    caseStage,
    blockers,
    geoVenueDistanceMeters,
    maxClockOffsetMs,
    trustBand: trustBand || 'unknown',
    sourceDeterministicScore,
    evidenceStrength,
    contributorTrustScore: toContributorTrustScore(contributor),
    recencyScore: clamp(1 - (recencyAgeDays / 30)),
    venueScaleScore: toVenueScaleScore({ merchant, matchedVenue }),
    analystPriorityBoost: clamp(
      ((reviewTrail?.analystReviews || []).length ? 0.6 : 0)
      + ((reviewTrail?.sourceReviews || []).length ? 0.2 : 0)
      + (String(rights?.analystStatus || '').toLowerCase() === 'confirmed' ? 0.2 : 0),
    ),
  };
};

const deriveQuality = ({
  capture,
  audio,
  source,
  visual,
  merchant,
  rights,
  reviewTrail,
  point,
  accuracy,
}) => {
  let score = 0;
  const notes = [];

  const durationSeconds = Number(capture?.durationSeconds || 0);
  if (durationSeconds >= 15 && durationSeconds <= 20) {
    score += 12;
    notes.push('Capture duration stayed inside the policy window.');
  } else if (durationSeconds >= 10) {
    score += 7;
    notes.push('Capture duration is usable but outside the preferred window.');
  } else {
    notes.push('Capture duration is short for enforcement review.');
  }

  if (capture?.geolocation?.start && capture?.geolocation?.end) {
    score += 12;
    notes.push('Start and end coordinates are both present.');
  } else if (point) {
    score += 6;
    notes.push('Only one reliable coordinate source is present.');
  } else {
    notes.push('No coordinate evidence is attached.');
  }

  if (accuracy != null) {
    if (accuracy <= 20) {
      score += 10;
      notes.push(`GPS accuracy averaged ${Math.round(accuracy)}m.`);
    } else if (accuracy <= 50) {
      score += 7;
    } else if (accuracy <= 100) {
      score += 3;
    } else {
      notes.push('GPS accuracy is coarse.');
    }
  }

  if (capture?.mediaSha256) {
    score += 8;
  } else {
    notes.push('Media hash is missing.');
  }

  if (capture?.assets?.rawVideo?.url) {
    score += 4;
  }
  if (capture?.assets?.derivedAudio?.url) {
    score += 4;
  }

  if (capture?.signatureStatus === 'signed_and_verified') {
    score += 12;
    notes.push('Finalize payload signature is verified.');
  } else {
    notes.push('Finalize payload is unsigned or unverified.');
  }

  if (capture?.clockSkewStatus === 'clear') {
    score += 4;
  } else if (capture?.clockSkewStatus === 'flagged') {
    score -= 4;
    notes.push('Clock skew was flagged during finalize.');
  }

  const matchConfidence = Number(audio?.matchedTrackConfidence || 0);
  score += Math.min(18, Math.round(matchConfidence * 18));
  if (matchConfidence >= 0.8) {
    notes.push(`Audio identification confidence is ${Math.round(matchConfidence * 100)}%.`);
  } else if (matchConfidence < 0.35) {
    notes.push('Song identification is unresolved or low confidence.');
  }

  const sourceConfidence = Number(source?.confidence || 0);
  score += Math.min(10, Math.round(sourceConfidence * 10));
  if (source?.sourceClass) {
    notes.push(`Source class resolved as ${humanizeToken(source.sourceClass)}.`);
  }

  const visualConfidence = Number(visual?.confidence || 0);
  score += Math.min(8, Math.round(visualConfidence * 8));
  if ((visual?.frames || []).length) {
    score += 4;
  }
  if ((visual?.venueIdentitySignals || []).length) {
    score += 4;
  }
  if ((visual?.obstructionFlags || []).length) {
    score -= 5;
    notes.push(`Visual obstruction flags: ${(visual.obstructionFlags || []).slice(0, 2).join(', ')}.`);
  }

  if (merchant?.gstin) {
    score += 5;
    notes.push('Merchant GSTIN is linked.');
  } else if (merchant?.id) {
    score += 3;
  } else {
    notes.push('Merchant identity is unresolved.');
  }

  if (rights?.case?.reference) {
    score += 4;
  }
  if (['unlicensed', 'expired'].includes(rights?.licenseAssessment?.status)) {
    score += 5;
  }

  const analystReviews = reviewTrail?.analystReviews || [];
  const sourceReviews = reviewTrail?.sourceReviews || [];
  if (analystReviews.length) {
    score += 3;
    notes.push('Analyst review trail exists.');
  }
  if (sourceReviews.length) {
    score += 2;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    notes: notes.slice(0, 5),
  };
};

const buildIntegritySignals = (report) => {
  const capture = report.capture;
  const point = report.point;
  const start = capture?.geolocation?.start || null;
  const end = capture?.geolocation?.end || null;
  const geoDelta = point && start && end
    ? Math.sqrt(((Number(start.lat) - Number(end.lat)) ** 2) + ((Number(start.lon) - Number(end.lon)) ** 2)) * 111000
    : null;

  return [
    {
      label: 'SHA-256 media hash',
      status: capture?.mediaSha256 ? 'pass' : 'warn',
      detail: capture?.mediaSha256 ? 'Hash stored with packet.' : 'Hash missing from packet.',
    },
    {
      label: 'Finalize signature',
      status: capture?.signatureStatus === 'signed_and_verified' ? 'pass' : 'warn',
      detail: humanizeToken(capture?.signatureStatus || 'unsigned_or_unverified'),
    },
    {
      label: 'Clock skew tolerance',
      status: capture?.clockSkewStatus === 'clear' ? 'pass' : 'warn',
      detail: humanizeToken(capture?.clockSkewStatus || 'unknown'),
    },
    {
      label: 'Coordinate continuity',
      status: geoDelta != null && geoDelta <= 20 ? 'pass' : 'warn',
      detail: geoDelta != null ? `${Math.round(geoDelta)}m start/end delta` : 'No start/end delta available',
    },
    {
      label: 'Consent version',
      status: capture?.consentVersion ? 'pass' : 'warn',
      detail: capture?.consentVersion || 'Missing',
    },
  ];
};

const buildMergedTrail = (report) => {
  const capture = report.capture || {};
  const trail = report.reviewTrail || { analystReviews: [], sourceReviews: [] };
  const events = [
    capture?.timestamps?.localStartTime ? {
      at: capture.timestamps.localStartTime,
      kind: 'capture',
      title: 'Recorder started',
      actor: capture.originSurface || 'field recorder',
      detail: 'Initial capture timestamp stored.',
    } : null,
    capture?.timestamps?.finalizedAt ? {
      at: capture.timestamps.finalizedAt,
      kind: 'integrity',
      title: 'Packet finalized',
      actor: capture.signatureStatus === 'signed_and_verified' ? 'integrity service' : 'finalize service',
      detail: `${humanizeToken(capture.signatureStatus)} / ${humanizeToken(capture.clockSkewStatus)}`,
    } : null,
    capture?.timestamps?.processingCompletedAt ? {
      at: capture.timestamps.processingCompletedAt,
      kind: 'processing',
      title: 'Processing completed',
      actor: 'media pipeline',
      detail: report.audio?.matchedSong || 'Track still unresolved',
    } : null,
    ...trail.analystReviews.map((entry) => ({
      at: entry.reviewedAt,
      kind: 'analyst',
      title: `Analyst verdict: ${humanizeToken(entry.verdict)}`,
      actor: entry.reviewerId || 'analyst',
      detail: entry.notes || (entry.tags || []).join(', ') || 'No additional notes.',
    })),
    ...trail.sourceReviews.map((entry) => ({
      at: entry.reviewedAt,
      kind: 'source',
      title: `Source override: ${humanizeToken(entry.reviewedClass)}`,
      actor: entry.reviewerId || 'source reviewer',
      detail: entry.notes || `Predicted ${humanizeToken(entry.predictedClass || 'unknown')}.`,
    })),
  ].filter(Boolean);

  return events.sort((left, right) => new Date(right.at || 0) - new Date(left.at || 0));
};

// eslint-disable-next-line react-refresh/only-export-components
export const normalizeReport = (report) => {
  const evidencePackage = report?.evidencePackage || {};
  const capture = evidencePackage.captureIntegrity || {};
  const audio = evidencePackage.audioIdentification || {};
  const source = evidencePackage.sourceAssessment || report?.sourceAnalysis || report?.submission?.sourceAnalysis || null;
  const visual = evidencePackage.visualContext || report?.visualAnalysis || report?.submission?.visualAnalysis || null;
  const application = evidencePackage.applicationLayer || report?.applicationAssessment || report?.submission?.applicationAssessment || null;
  const locationDelta = evidencePackage.locationDelta || evidencePackage?.venueContext?.locationDelta || null;
  const venueContext = evidencePackage.venueContext || {};
  const rights = evidencePackage.rightsAndCaseContext || {};
  const reviewTrail = evidencePackage.reviewTrail || { analystReviews: [], sourceReviews: [] };
  const point = derivePoint(report);
  const start = capture?.geolocation?.start || report?.submission?.geolocationStart || null;
  const end = capture?.geolocation?.end || report?.submission?.geolocationEnd || null;
  const accuracyValues = [start?.accuracy, end?.accuracy].map((value) => Number(value)).filter(Number.isFinite);
  const averageAccuracy = average(accuracyValues);
  const selectedVenue = venueContext?.selectedVenue || report?.submission?.selectedVenue || null;
  const matchedVenue = venueContext?.matchedVenue || report?.venue || null;
  const merchant = venueContext?.merchant || report?.merchant || null;
  const caseView = report?.case || rights?.case || null;
  const rawRadioEvidence = parseMaybeJson(report?.submission?.radioEvidence);
  const radioSnapshots = {
    start: rawRadioEvidence?.start || null,
    end: rawRadioEvidence?.end || null,
    limitations: rawRadioEvidence?.limitations || evidencePackage?.radioContext?.limitations || [],
  };
  const venueName = matchedVenue?.name || selectedVenue?.name || report?.submission?.matchedVenue || 'Venue unresolved';
  const city = matchedVenue?.city || selectedVenue?.city || 'Unknown city';
  const songTitle = audio?.title || report?.title || 'Unknown Track';
  const songArtist = audio?.artist || report?.artist || 'Unknown Artist';
  const quality = deriveQuality({
    capture,
    audio,
    source,
    visual,
    merchant,
    rights,
    reviewTrail,
    point,
    accuracy: averageAccuracy,
  });
  const qualityBand = toBand(quality.score);
  const sourceSignals = source?.signals && typeof source.signals === 'object' ? source.signals : {};
  const iprs = buildIprsAssessment({
    capture,
    audio,
    source,
    visual,
    rights,
    reviewTrail,
    point,
    locationDelta,
    merchant,
    matchedVenue,
    selectedVenue,
    contributor: evidencePackage?.contributorContext || caseView?.contributor || null,
    createdAt: report.createdAt || report?.submission?.createdAt || capture?.timestamps?.finalizedAt || null,
  });

  return {
    id: report.id,
    reference: report.reference,
    createdAt: report.createdAt || report?.submission?.createdAt || capture?.timestamps?.finalizedAt || null,
    title: songTitle,
    artist: songArtist,
    qualityScore: quality.score,
    qualityBand,
    qualityNotes: quality.notes,
    matchConfidence: Number(audio?.matchedTrackConfidence || report?.matchedTrackConfidence || 0),
    sourceClass: source?.sourceClass || null,
    sourceConfidence: Number(source?.confidence || 0),
    sourceSignals,
    application,
    locationDelta,
    applicationDisposition: application?.recommendedDisposition || 'manual_review',
    locationContext: application?.locationContext || 'inconclusive',
    applicationAttackReadiness: Number(application?.attackReadiness || 0),
    applicationRiskPenalty: Math.max(
      Number(application?.venueAttributionRisk || 0),
      Number(application?.privateSpaceRisk || 0),
      Number(application?.replayRisk || 0),
      Number(application?.outletAmbiguityRisk || 0),
      Number(application?.farmingRisk || 0),
    ),
    playbackContext: visual?.playbackContext || null,
    visualConfidence: Number(visual?.confidence || 0),
    frameCount: Array.isArray(visual?.frames) ? visual.frames.length : 0,
    hasVisualFrames: Array.isArray(visual?.frames) && visual.frames.length > 0,
    hasRadioContext: Boolean(evidencePackage?.radioContext?.wifi || evidencePackage?.radioContext?.bluetooth),
    hasMerchant: Boolean(merchant?.id),
    hasGstin: Boolean(merchant?.gstin),
    hasCase: Boolean(caseView?.id || rights?.case?.id),
    hasReviewTrail: Boolean((reviewTrail?.analystReviews || []).length || (reviewTrail?.sourceReviews || []).length),
    signatureStatus: capture?.signatureStatus || 'unsigned_or_unverified',
    clockSkewStatus: capture?.clockSkewStatus || 'unknown',
    consentVersion: capture?.consentVersion || null,
    durationSeconds: Number(capture?.durationSeconds || report?.submission?.durationSeconds || 0),
    estimatedRecoverableValueInr: Number(rights?.estimatedRecoverableValueInr || report?.estimatedRecoverableValueInr || 0),
    licenseStatus: rights?.licenseAssessment?.status || report?.licenseAssessment?.status || 'unknown',
    analystStatus: rights?.analystStatus || report?.analystStatus || 'unreviewed',
    rightsOrg: rights?.org?.name || report?.org?.name || null,
    rightsType: rights?.rightsType || rights?.rightsTypeText || rights?.type || null,
    merchant,
    caseView,
    contributor: evidencePackage?.contributorContext || caseView?.contributor || null,
    venueName,
    city,
    venueKey: matchedVenue?.id || `${venueName}::${city}`,
    targetVenueKey: merchant?.gstin || matchedVenue?.id || `${venueName}::${city}`,
    selectedVenue,
    matchedVenue,
    venueHistory: venueContext?.venueHistory || {},
    point,
    averageAccuracy,
    capture,
    audio,
    source,
    visual,
    radio: evidencePackage?.radioContext || {},
    radioSnapshots,
    reviewTrail,
    iprs,
    raw: report,
  };
};

const buildTimelineSeries = (reports) => {
  const buckets = new Map();
  reports.forEach((report) => {
    const key = report.createdAt ? new Date(report.createdAt).toISOString().slice(0, 10) : 'unknown';
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, reports: 0, recoverable: 0 });
    }
    const bucket = buckets.get(key);
    bucket.reports += 1;
    bucket.recoverable += report.estimatedRecoverableValueInr;
  });

  return [...buckets.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((entry) => ({
      ...entry,
      label: entry.date === 'unknown' ? 'Unknown' : formatShortDate(entry.date),
    }));
};

// eslint-disable-next-line react-refresh/only-export-components
export const buildVenueStats = (reports) => {
  const grouped = new Map();
  reports.forEach((report) => {
    const targetKey = report.merchant?.gstin || report.venueKey;
    if (!grouped.has(targetKey)) {
      grouped.set(targetKey, {
        key: targetKey,
        venueName: report.venueName,
        city: report.city,
        latitudes: [],
        longitudes: [],
        reports: [],
      });
    }
    const bucket = grouped.get(targetKey);
    bucket.reports.push(report);
    if (report.point) {
      bucket.latitudes.push(report.point.lat);
      bucket.longitudes.push(report.point.lon);
    }
  });

  return [...grouped.values()]
    .map((entry) => ({
      key: entry.key,
      venueName: entry.venueName,
      city: entry.city,
      reportCount: entry.reports.length,
      lat: average(entry.latitudes) || null,
      lon: average(entry.longitudes) || null,
      averageQuality: Math.round(average(entry.reports.map((report) => report.qualityScore)) || 0),
      averageConfidence: average(entry.reports.map((report) => report.matchConfidence)) || 0,
      estimatedRecoverableValueInr: sum(entry.reports.map((report) => report.estimatedRecoverableValueInr)),
      merchantLinkedCount: entry.reports.filter((report) => report.hasMerchant).length,
      reviewedCount: entry.reports.filter((report) => report.analystStatus === 'confirmed').length,
      actionableCount: entry.reports.filter((report) => report.iprs.caseStage === 'actionable').length,
      provisionalCount: entry.reports.filter((report) => report.iprs.caseStage === 'provisional').length,
      rejectedCount: entry.reports.filter((report) => report.iprs.caseStage === 'rejected').length,
      latestAt: entry.reports
        .map((report) => report.createdAt)
        .filter(Boolean)
        .sort((left, right) => new Date(right) - new Date(left))[0] || null,
      qualityBand: toBand(Math.round(average(entry.reports.map((report) => report.qualityScore)) || 0)),
      averageEvidenceStrength: average(entry.reports.map((report) => report.iprs.evidenceStrength)) || 0,
      averageContributorTrust: average(entry.reports.map((report) => report.iprs.contributorTrustScore)) || 0.5,
      averageVenueScale: average(entry.reports.map((report) => report.iprs.venueScaleScore)) || 0.5,
      averageAnalystPriority: average(entry.reports.map((report) => report.iprs.analystPriorityBoost)) || 0,
      averageAttackReadiness: average(entry.reports.map((report) => report.applicationAttackReadiness)) || 0,
      averageApplicationRisk: average(entry.reports.map((report) => report.applicationRiskPenalty)) || 0,
      attackReadyCount: entry.reports.filter((report) => report.applicationDisposition === 'attack_now').length,
      corroborationCount: entry.reports.filter((report) => report.applicationDisposition === 'build_corroboration').length,
      repeatPressure: Math.max(
        entry.reports.length,
        ...entry.reports.map((report) => Number(report.venueHistory?.reports90Days || 0)),
      ),
      recentCount7d: entry.reports.filter((report) => {
        if (!report.createdAt) {
          return false;
        }
        return (Date.now() - new Date(report.createdAt).getTime()) <= (7 * 24 * 60 * 60 * 1000);
      }).length,
      recentCount30d: entry.reports.filter((report) => {
        if (!report.createdAt) {
          return false;
        }
        return (Date.now() - new Date(report.createdAt).getTime()) <= (30 * 24 * 60 * 60 * 1000);
      }).length,
      reports: entry.reports.slice().sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)),
    }))
    .map((entry, _, collection) => {
      const maxRecoverable = Math.max(...collection.map((item) => item.estimatedRecoverableValueInr || 0), 1);
      const maxRepeatPressure = Math.max(...collection.map((item) => item.repeatPressure || 0), 1);
      const repeatNorm = clamp(entry.repeatPressure / maxRepeatPressure);
      const recoverableNorm = clamp(entry.estimatedRecoverableValueInr / maxRecoverable);
      const recencyNorm = clamp(((entry.recentCount7d * 1.5) + entry.recentCount30d) / 6);
      const targetScore = Math.max(0, Math.round(
        (recoverableNorm * 26)
        + (repeatNorm * 22)
        + (entry.averageEvidenceStrength * 12)
        + (entry.averageVenueScale * 10)
        + (recencyNorm * 6)
        + (entry.averageContributorTrust * 4)
        + (entry.averageAnalystPriority * 4)
        + (entry.averageAttackReadiness * 16)
        - (entry.averageApplicationRisk * 18)
      ));

      return {
        ...entry,
        targetScore,
      };
    })
    .sort((left, right) => right.targetScore - left.targetScore || right.estimatedRecoverableValueInr - left.estimatedRecoverableValueInr)
    .map((entry, index, collection) => ({
      ...entry,
      priorityBand: entry.actionableCount > 0 && entry.averageAttackReadiness >= 0.65 && entry.averageApplicationRisk < 0.4 && index < Math.max(1, Math.ceil(collection.length * 0.2))
        ? 'immediate_action'
        : entry.provisionalCount > 0 || entry.averageAttackReadiness >= 0.4 || index < Math.max(2, Math.ceil(collection.length * 0.6))
          ? 'watchlist'
          : 'parked',
    }));
};

const buildSongStats = (reports) => {
  const grouped = new Map();
  reports.forEach((report) => {
    const key = `${report.title}::${report.artist}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        title: report.title,
        artist: report.artist,
        reports: [],
        labels: new Set(),
        venues: new Set(),
      });
    }
    const bucket = grouped.get(key);
    bucket.reports.push(report);
    if (report.audio?.label) {
      bucket.labels.add(report.audio.label);
    }
    bucket.venues.add(report.venueName);
  });

  return [...grouped.values()]
    .map((entry) => ({
      key: entry.key,
      title: entry.title,
      artist: entry.artist,
      count: entry.reports.length,
      averageConfidence: average(entry.reports.map((report) => report.matchConfidence)) || 0,
      labels: [...entry.labels],
      venueCount: entry.venues.size,
    }))
    .sort((left, right) => right.count - left.count || right.averageConfidence - left.averageConfidence);
};

// eslint-disable-next-line react-refresh/only-export-components
export const buildCityStats = (reports) => {
  const grouped = new Map();
  reports.forEach((report) => {
    const key = report.city || 'Unknown city';
    if (!grouped.has(key)) {
      grouped.set(key, {
        city: key,
        reports: [],
      });
    }
    grouped.get(key).reports.push(report);
  });

  return [...grouped.values()]
    .map((entry) => ({
      city: entry.city,
      count: entry.reports.length,
      averageQuality: Math.round(average(entry.reports.map((report) => report.qualityScore)) || 0),
      recoverable: sum(entry.reports.map((report) => report.estimatedRecoverableValueInr)),
    }))
    .sort((left, right) => right.count - left.count);
};

const buildEvidenceCoverage = (reports) => {
  const total = reports.length || 1;
  const sections = [
    { label: 'Capture integrity', count: reports.filter((report) => report.capture?.mediaSha256 && report.durationSeconds).length },
    { label: 'Audio identification', count: reports.filter((report) => report.audio?.matchedSong || report.audio?.title).length },
    { label: 'Source assessment', count: reports.filter((report) => report.source?.sourceClass).length },
    { label: 'Visual context', count: reports.filter((report) => report.visual).length },
    { label: 'Visual frames', count: reports.filter((report) => report.frameCount > 0).length },
    { label: 'Radio context', count: reports.filter((report) => report.hasRadioContext).length },
    { label: 'Venue context', count: reports.filter((report) => report.matchedVenue || report.selectedVenue).length },
    { label: 'Merchant linkage', count: reports.filter((report) => report.hasMerchant).length },
    { label: 'Rights / case', count: reports.filter((report) => report.hasCase).length },
    { label: 'Review trail', count: reports.filter((report) => report.hasReviewTrail).length },
  ];

  return sections.map((section) => ({
    ...section,
    ratio: section.count / total,
  }));
};

const buildIntegrityAlerts = (reports) => {
  const alerts = [
    {
      key: 'unsigned',
      label: 'Unsigned or unverified packets',
      count: reports.filter((report) => report.signatureStatus !== 'signed_and_verified').length,
      tone: 'warn',
    },
    {
      key: 'unreviewed',
      label: 'Unreviewed packets',
      count: reports.filter((report) => report.analystStatus === 'unreviewed').length,
      tone: 'warn',
    },
    {
      key: 'merchant',
      label: 'Merchant identity unresolved',
      count: reports.filter((report) => !report.hasMerchant).length,
      tone: 'warn',
    },
    {
      key: 'visual',
      label: 'No visual corroboration',
      count: reports.filter((report) => !report.visual).length,
      tone: 'warn',
    },
    {
      key: 'audio',
      label: 'Low audio confidence',
      count: reports.filter((report) => report.matchConfidence < 0.35).length,
      tone: 'warn',
    },
    {
      key: 'strong',
      label: 'Prime-ready packets',
      count: reports.filter((report) => report.qualityBand === 'strong').length,
      tone: 'pass',
    },
  ];

  return alerts.sort((left, right) => right.count - left.count);
};

// eslint-disable-next-line react-refresh/only-export-components
export const buildIprsCaseSummary = (reports) => ({
  actionable: reports.filter((report) => report.iprs.caseStage === 'actionable').length,
  provisional: reports.filter((report) => report.iprs.caseStage === 'provisional').length,
  rejected: reports.filter((report) => report.iprs.caseStage === 'rejected').length,
  integrityPass: reports.filter((report) => report.iprs.integrityPass).length,
  evidencePass: reports.filter((report) => report.iprs.evidencePass).length,
  rightsPass: reports.filter((report) => report.iprs.rightsPass).length,
});

const buildConfidenceBuckets = (reports) => {
  const buckets = [
    { label: '<35%', range: [0, 0.35], count: 0 },
    { label: '35-50%', range: [0.35, 0.5], count: 0 },
    { label: '50-70%', range: [0.5, 0.7], count: 0 },
    { label: '70-85%', range: [0.7, 0.85], count: 0 },
    { label: '>85%', range: [0.85, 1.01], count: 0 },
  ];

  reports.forEach((report) => {
    const confidence = report.matchConfidence;
    const bucket = buckets.find((entry) => confidence >= entry.range[0] && confidence < entry.range[1]);
    if (bucket) {
      bucket.count += 1;
    }
  });

  return buckets;
};

const buildSourceClassBreakdown = (reports) => {
  const grouped = new Map();
  reports.forEach((report) => {
    const key = report.sourceClass || 'missing';
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return [...grouped.entries()]
    .map(([key, value]) => ({
      key,
      label: humanizeToken(key),
      value,
    }))
    .sort((left, right) => right.value - left.value);
};

const ToneBadge = ({ children, toneClass = '' }) => (
  <span className={`authority-data inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${toneClass}`}>
    {children}
  </span>
);

const QueueBadge = ({ status }) => (
  <ToneBadge toneClass={STATUS_META[status] || STATUS_META.unreviewed}>
    {humanizeToken(status)}
  </ToneBadge>
);

const QualityBadge = ({ band }) => {
  const meta = QUALITY_META[band] || QUALITY_META.review;
  return (
    <ToneBadge toneClass={`${meta.fill} ${meta.border} ${meta.text}`}>
      {meta.label}
    </ToneBadge>
  );
};

const IprsStageBadge = ({ stage }) => (
  <ToneBadge toneClass={IPRS_CASE_STAGE_META[stage] || IPRS_CASE_STAGE_META.rejected}>
    {stage === 'actionable' ? 'Actionable' : stage === 'provisional' ? 'Provisional' : 'Rejected'}
  </ToneBadge>
);

const IprsPriorityBadge = ({ band }) => (
  <ToneBadge toneClass={IPRS_PRIORITY_META[band] || IPRS_PRIORITY_META.parked}>
    {band === 'immediate_action' ? 'Immediate Action' : band === 'watchlist' ? 'Watchlist' : 'Parked'}
  </ToneBadge>
);

const IprsGateBadge = ({ pass }) => (
  <ToneBadge toneClass={pass ? IPRS_GATE_META.pass : IPRS_GATE_META.fail}>
    {pass ? 'Pass' : 'Fail'}
  </ToneBadge>
);

const ApplicationDispositionBadge = ({ disposition }) => (
  <ToneBadge toneClass={APPLICATION_DISPOSITION_META[disposition] || APPLICATION_DISPOSITION_META.manual_review}>
    {disposition === 'attack_now'
      ? 'Attack Now'
      : disposition === 'build_corroboration'
        ? 'Build Corroboration'
        : disposition === 'do_not_pursue'
          ? 'Do Not Pursue'
          : 'Manual Review'}
  </ToneBadge>
);

const SectionHeader = ({ eyebrow, title, helper, action }) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>
      {eyebrow && <p className="authority-label text-[10px] text-[#9e9278]">{eyebrow}</p>}
      <h2 className="mt-2 text-xl font-semibold uppercase tracking-[0.06em] text-[#f5ecd7] sm:text-2xl">{title}</h2>
      {helper && <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c0b6a0]">{helper}</p>}
    </div>
    {action}
  </div>
);

const StatCard = ({ label, value, helper, icon: Icon }) => (
  <div className="authority-panel authority-grid-bg rounded-[22px] p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="authority-label text-[10px] text-[#9e9278]">{label}</p>
      {Icon && <Icon size={16} className="text-[#d7b667]" />}
    </div>
    <p className="authority-data mt-4 text-3xl font-semibold text-[#f5ecd7]">{value}</p>
    {helper && <p className="mt-2 text-sm text-[#b7ad97]">{helper}</p>}
  </div>
);

const MetaRow = ({ label, value, mono = false }) => (
  <div className="flex items-start justify-between gap-4 border-b border-[#4c4332]/65 py-3 last:border-b-0">
    <p className="text-sm text-[#a89d87]">{label}</p>
    <p className={`max-w-[58%] text-right text-sm font-medium text-[#f3ead6] ${mono ? 'authority-data break-all text-[12px]' : ''}`}>{value}</p>
  </div>
);

const CoverageRow = ({ label, count, ratio }) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
      <span className="text-[#cec4ae]">{label}</span>
      <span className="authority-data text-[#f5ecd7]">{count}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-[#322c21]">
      <div className="h-2 rounded-full bg-[#d7b667]" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  </div>
);

const TrailEvent = ({ event }) => {
  const iconClass = event.kind === 'analyst' || event.kind === 'source'
    ? 'bg-[#92a16d]/18 border-[#92a16d]/35 text-[#d9e7bf]'
    : event.kind === 'integrity'
      ? 'bg-[#d7b667]/18 border-[#d7b667]/35 text-[#f0dab2]'
      : 'bg-[#6d7f86]/16 border-[#6d7f86]/35 text-[#d0dbdf]';

  return (
    <div className="relative pl-10">
      <div className="absolute left-[11px] top-[18px] h-full w-px bg-[#4c4332]" />
      <div className={`absolute left-0 top-2 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${iconClass}`}>
        {event.kind === 'analyst' ? 'A' : event.kind === 'source' ? 'S' : 'T'}
      </div>
      <div className="authority-panel rounded-[20px] p-4">
        <p className="authority-data text-[11px] uppercase tracking-[0.2em] text-[#9e9278]">{formatDateTime(event.at)}</p>
        <p className="mt-2 text-base font-medium text-[#f5ecd7]">{event.title}</p>
        <p className="mt-2 text-sm text-[#c4b8a1]">{event.detail}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#8f856f]">{event.actor}</p>
      </div>
    </div>
  );
};

const QueueItem = ({
  report,
  isSelected,
  isChecked,
  onSelect,
  onToggle,
}) => {
  const quality = QUALITY_META[report.qualityBand] || QUALITY_META.review;

  return (
    <div
      className={`w-full rounded-[20px] border p-4 text-left transition ${
        isSelected
          ? 'border-[#d7b667]/45 bg-[#2f281d]'
          : 'border-[#4c4332]/70 bg-[#1f1a13] hover:bg-[#262017]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="min-w-0">
            <p className="authority-data text-[11px] uppercase tracking-[0.18em] text-[#9f947c]">{report.reference}</p>
            <p className="mt-2 truncate text-[15px] font-medium text-[#f5ecd7]">{report.title}</p>
            <p className="truncate text-sm text-[#b8ae97]">{report.artist}</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <QueueBadge status={report.analystStatus} />
            <IprsStageBadge stage={report.iprs.caseStage} />
            <QualityBadge band={report.qualityBand} />
            <ToneBadge toneClass={`${quality.fill} ${quality.border} ${quality.text}`}>
              {report.qualityScore}/100
            </ToneBadge>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#312a1f]">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.round(report.matchConfidence * 100)}%`, backgroundColor: quality.point }} />
            </div>
            <span className="authority-data text-[11px] text-[#d6ccb7]">{Math.round(report.matchConfidence * 100)}%</span>
          </div>

          <div className="mt-3 grid gap-1 text-xs text-[#928871]">
            <p>{report.venueName} • {report.city}</p>
            <p>{formatRelativeTime(report.createdAt)} • {report.hasMerchant ? 'merchant linked' : 'merchant pending'}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggle}
          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${
            isChecked
              ? 'border-[#d7b667] bg-[#d7b667]/15 text-[#f0dab2]'
              : 'border-[#5a4f3d] bg-[#18140f] text-transparent'
          }`}
          aria-label={isChecked ? 'Remove packet from export selection' : 'Add packet to export selection'}
        >
          <CheckCircle2 size={12} />
        </button>
      </div>
    </div>
  );
};

const AssetLink = ({ href, children, toneClass }) => {
  const resolvedHref = resolveAssetUrl(href);

  if (!resolvedHref) {
    return null;
  }

  return (
    <a
      href={resolvedHref}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${toneClass}`}
    >
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
};

const EvidenceFrameLink = ({ frame }) => {
  const frameUrl = resolveAssetUrl(frame.url);

  if (!frameUrl) {
    return null;
  }

  return (
    <a
      href={frameUrl}
      target="_blank"
      rel="noreferrer"
      className="overflow-hidden rounded-[18px] border border-[#4d4433] bg-[#17120e] transition hover:border-[#d7b667]/45"
    >
      <img src={frameUrl} alt={`Peak frame at ${frame.timestampSeconds}s`} className="h-36 w-full object-cover" />
      <div className="px-3 py-3 text-xs text-[#d6ccb7]">
        <p>Peak {frame.peakRank || 'n/a'} at {frame.timestampSeconds ?? 'n/a'}s</p>
        <p className="mt-1 text-[#928871]">Intensity x{frame.relativeIntensity ?? 'n/a'}</p>
      </div>
    </a>
  );
};

const LeaderboardItem = ({ rank, title, subtitle, value, ratio, onClick, active = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
      active
        ? 'border-[#d7b667]/45 bg-[#2d271c]'
        : 'border-[#4c4332]/60 bg-[#1e1912] hover:bg-[#262017]'
    }`}
  >
    <div className="authority-data w-7 text-right text-[11px] text-[#8e836d]">{rank}</div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-[#f4ebd6]">{title}</p>
      <p className="truncate text-xs text-[#a89d87]">{subtitle}</p>
    </div>
    <div className="w-16 overflow-hidden rounded-full bg-[#342d21]">
      <div className="h-1.5 rounded-full bg-[#d7b667]" style={{ width: `${Math.max(8, Math.round(ratio * 100))}%` }} />
    </div>
    <div className="authority-data text-sm text-[#f4ebd6]">{value}</div>
  </button>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="authority-panel rounded-[16px] border px-3 py-2 text-xs text-[#e8dec8] shadow-[0_14px_30px_rgba(0,0,0,0.32)]">
      {label && <p className="authority-data text-[10px] uppercase tracking-[0.18em] text-[#9c9078]">{label}</p>}
      <div className="mt-1 space-y-1">
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color || '#f4ebd6' }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    </div>
  );
};

export const AuthorityPage = () => {
  const [token, setToken] = useState(loadSavedToken);
  const [me, setMe] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState([]);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [selectedSidebarTab, setSelectedSidebarTab] = useState('queue');
  const [selectedMainTab, setSelectedMainTab] = useState('overview');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedVenueKey, setSelectedVenueKey] = useState('');
  const [selectedExportIds, setSelectedExportIds] = useState([]);
  const [exportUrl, setExportUrl] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loginForm, setLoginForm] = useState(DEFAULT_LOGIN_FORM);
  const [error, setError] = useState(null);

  const loadAuthorityData = useCallback(async (sessionToken) => {
    const [session, dashboardPayload, reportsPayload] = await Promise.all([
      getPortalSession(sessionToken),
      getPortalDashboard(sessionToken),
      getPortalReports(sessionToken),
    ]);

    setMe(session.user);
    setDashboard(dashboardPayload);
    setReports(reportsPayload.reports || []);
    setSelectedExportIds((current) => current.filter((reportId) => (reportsPayload.reports || []).some((report) => report.id === reportId)));
  }, []);

  const loadDemoAccounts = useCallback(async () => {
    try {
      const payload = await getDemoAccounts();
      const sortedAccounts = sortDemoAccounts(payload.accounts || []);
      setDemoAccounts(sortedAccounts);
      return sortedAccounts;
    } catch {
      setDemoAccounts([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (token) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void loadDemoAccounts();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadDemoAccounts();
    }, 15000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadDemoAccounts, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    const load = async () => {
      try {
        await loadAuthorityData(token);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError.message);
        window.localStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
        setToken('');
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [loadAuthorityData, token]);

  const normalizedReports = useMemo(
    () => reports.map(normalizeReport).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)),
    [reports],
  );

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return normalizedReports.filter((report) => {
      if (statusFilter && report.analystStatus !== statusFilter) {
        return false;
      }
      if (qualityFilter && report.qualityBand !== qualityFilter) {
        return false;
      }
      if (sourceFilter && (report.sourceClass || 'missing') !== sourceFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [
        report.reference,
        report.title,
        report.artist,
        report.venueName,
        report.city,
        report.licenseStatus,
        report.rightsOrg,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [normalizedReports, qualityFilter, searchQuery, sourceFilter, statusFilter]);

  const effectiveSelectedReport = useMemo(() => {
    if (!filteredReports.length) {
      return null;
    }

    return filteredReports.find((report) => report.id === selectedReportId) || filteredReports[0];
  }, [filteredReports, selectedReportId]);

  const venueStats = useMemo(() => buildVenueStats(filteredReports), [filteredReports]);
  const songStats = useMemo(() => buildSongStats(filteredReports), [filteredReports]);
  const cityStats = useMemo(() => buildCityStats(filteredReports), [filteredReports]);
  const timelineSeries = useMemo(() => buildTimelineSeries(filteredReports), [filteredReports]);
  const coverageSeries = useMemo(() => buildEvidenceCoverage(filteredReports), [filteredReports]);
  const integrityAlerts = useMemo(() => buildIntegrityAlerts(filteredReports), [filteredReports]);
  const confidenceBuckets = useMemo(() => buildConfidenceBuckets(filteredReports), [filteredReports]);
  const sourceBreakdown = useMemo(() => buildSourceClassBreakdown(filteredReports), [filteredReports]);
  const iprsCaseSummary = buildIprsCaseSummary(filteredReports);
  const immediateActionVenues = venueStats.filter((venue) => venue.priorityBand === 'immediate_action');
  const watchlistVenues = venueStats.filter((venue) => venue.priorityBand === 'watchlist');
  const topTargetVenues = venueStats.slice(0, 6);

  const activeVenue = useMemo(() => {
    if (selectedVenueKey) {
      return venueStats.find((venue) => venue.key === selectedVenueKey) || null;
    }
    if (effectiveSelectedReport) {
      return venueStats.find((venue) => venue.key === effectiveSelectedReport.targetVenueKey) || null;
    }
    return venueStats[0] || null;
  }, [effectiveSelectedReport, selectedVenueKey, venueStats]);

  const totalVisibleReports = filteredReports.length;
  const recoverableValue = sum(filteredReports.map((report) => report.estimatedRecoverableValueInr));
  const overviewMetrics = [
    {
      label: 'Actionable cases',
      value: compactNumber.format(iprsCaseSummary.actionable || 0),
      helper: `${iprsCaseSummary.integrityPass} integrity clears / ${iprsCaseSummary.evidencePass} evidence clears`,
      icon: ShieldCheck,
    },
    {
      label: 'Provisional cases',
      value: compactNumber.format(iprsCaseSummary.provisional || 0),
      helper: `${iprsCaseSummary.rightsPass} rights clears / ${iprsCaseSummary.rejected} rejected by gates`,
      icon: AlertTriangle,
    },
    {
      label: 'Immediate-action venues',
      value: compactNumber.format(immediateActionVenues.length || 0),
      helper: `${watchlistVenues.length} watchlist venues / ${venueStats.length} total venue entities`,
      icon: MapPinned,
    },
    {
      label: 'Recoverable value',
      value: formatInr(recoverableValue),
      helper: `${dashboard?.totals?.realizedValueInr ? `${formatInr(dashboard.totals.realizedValueInr)} realized` : 'No realized value yet'}`,
      icon: Landmark,
    },
  ];

  const selectedTrail = useMemo(
    () => (effectiveSelectedReport ? buildMergedTrail(effectiveSelectedReport) : []),
    [effectiveSelectedReport],
  );

  const selectedIntegritySignals = useMemo(
    () => (effectiveSelectedReport ? buildIntegritySignals(effectiveSelectedReport) : []),
    [effectiveSelectedReport],
  );
  const selectedVisualCueBuckets = effectiveSelectedReport
    ? getVisualCueBuckets(effectiveSelectedReport.visual?.visibleEquipment)
    : { playbackCues: [], sceneObjects: [] };

  const topVenueMax = venueStats[0]?.targetScore || 1;
  const topSongMax = songStats[0]?.count || 1;

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);

    try {
      const session = await loginPortal(loginForm);
      window.localStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, session.token);
      setToken(session.token);
      setSelectedSidebarTab('queue');
      setSelectedMainTab('overview');
    } catch (loginError) {
      setError(loginError.message);
    }
  };

  const handleUseDemoAccount = useCallback(async (account) => {
    setError(null);

    const latestAccounts = await loadDemoAccounts();
    const latestAccount = latestAccounts.find((entry) => entry.email === account.email) || account;

    setLoginForm({
      email: latestAccount.email,
      password: 'snitch-demo-2026',
      totpCode: latestAccount.currentTotpCode || '',
    });
  }, [loadDemoAccounts]);

  const handleLogout = () => {
    window.localStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
    setToken('');
    setMe(null);
    setDashboard(null);
    setReports([]);
    setSelectedReportId(null);
    setSelectedVenueKey('');
    setSelectedExportIds([]);
    setExportUrl(null);
  };

  const handleExport = async () => {
    if (!token || !selectedExportIds.length) {
      return;
    }

    try {
      const payload = await createCasePacket(token, { reportIds: selectedExportIds });
      setExportUrl(payload.exportUrl);
      await loadAuthorityData(token);
    } catch (exportError) {
      setError(exportError.message);
    }
  };

  if (!token) {
    return (
      <div className="authority-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="authority-panel authority-grid-bg rounded-[32px] p-6 sm:p-8">
            <p className="authority-label text-[10px] text-[#9e9278]">Temporal Enforcement Desk</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold uppercase tracking-[0.06em] text-[#f5ecd7] sm:text-5xl">
              Authority-first evidence command board.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#c4b9a2]">
              This console ingests every visible evidence package, aggregates the database into venue and song hotzones,
              and opens each packet as a retro forensic dossier. Use the platform admin seed to sweep the full local dataset.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard label="Seeded packets" value="11" helper="Current local evidence count" icon={FileSearch} />
              <StatCard label="Mapped venues" value="6" helper="Geospatial hotzones ready" icon={MapPinned} />
              <StatCard label="Visual frames" value="6" helper="Packets with extracted frame evidence" icon={Camera} />
            </div>

            <form onSubmit={handleLogin} className="mt-8 grid gap-4 rounded-[28px] border border-[#4a4232] bg-[#15110c]/92 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-[#d2c8b2]">
                  <span className="authority-label mb-2 block text-[10px] text-[#8f846d]">Account</span>
                  <input
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-2xl border border-[#4f4533] bg-[#0d0b08] px-4 py-3 text-[#f5ecd7] outline-none placeholder:text-[#756b58]"
                    placeholder="admin@snitch.local"
                  />
                </label>

                <label className="text-sm text-[#d2c8b2]">
                  <span className="authority-label mb-2 block text-[10px] text-[#8f846d]">Password</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-2xl border border-[#4f4533] bg-[#0d0b08] px-4 py-3 text-[#f5ecd7] outline-none placeholder:text-[#756b58]"
                    placeholder="snitch-demo-2026"
                  />
                </label>
              </div>

              <label className="text-sm text-[#d2c8b2]">
                <span className="authority-label mb-2 block text-[10px] text-[#8f846d]">TOTP pulse</span>
                <input
                  value={loginForm.totpCode}
                  onChange={(event) => setLoginForm((current) => ({ ...current, totpCode: event.target.value }))}
                  className="w-full rounded-2xl border border-[#4f4533] bg-[#0d0b08] px-4 py-3 text-[#f5ecd7] outline-none placeholder:text-[#756b58]"
                  placeholder="123456"
                />
              </label>

              {error && (
                <div className="rounded-2xl border border-[#ad5242]/40 bg-[#ad5242]/12 px-4 py-3 text-sm text-[#efc4bc]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-[#d7b667]/55 bg-[#d7b667]/14 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#f4deb2] transition hover:bg-[#d7b667]/20"
              >
                Open authority console
              </button>
            </form>
          </section>

          <aside className="authority-panel rounded-[32px] p-6">
            <SectionHeader
              eyebrow="Seeded access"
              title="Quick-fill demo credentials"
              helper="Platform admin sees the full seeded evidence database. Org analysts see only their scoped packets. Codes rotate, and Use account pulls a fresh pulse."
            />

            <div className="mt-6 space-y-4">
              {demoAccounts.map((account) => (
                <div key={account.email} className="rounded-[24px] border border-[#4a4232] bg-[#18130f] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#f5ecd7]">{account.org}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#8f846d]">{account.role}</p>
                    </div>
                    {account.email === 'admin@snitch.local' && (
                      <ToneBadge toneClass="border-[#d7b667]/35 bg-[#d7b667]/14 text-[#f0dab2]">
                        Full sweep
                      </ToneBadge>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-[#c7bca6]">
                    <p>{account.email}</p>
                    <p className="authority-data text-[#f0dab2]">TOTP {account.currentTotpCode || 'Unavailable'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUseDemoAccount(account)}
                    className="mt-4 w-full rounded-full border border-[#4d4332] bg-[#0d0b08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#f5ecd7] transition hover:border-[#d7b667]/45 hover:text-[#f4deb2]"
                  >
                    Use account
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="authority-shell min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
        <header className="authority-panel authority-grid-bg rounded-[30px] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#5a4f3c] bg-[#18140f]">
                <span className="authority-data text-sm text-[#f2dab0]">T-7</span>
              </div>
              <div>
                <p className="authority-label text-[10px] text-[#948973]">Temporal Rights Authority</p>
                <h1 className="mt-1 text-2xl font-semibold uppercase tracking-[0.08em] text-[#f5ecd7] sm:text-3xl">
                  Evidence command dashboard
                </h1>
                <p className="mt-1 text-sm text-[#bbb19c]">
                  Live authority board for venue hotzones, packet integrity, and case export.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ToneBadge toneClass="border-[#92a16d]/35 bg-[#92a16d]/14 text-[#d9e7bf]">
                {filteredReports.length} visible packets
              </ToneBadge>
              <ToneBadge toneClass="border-[#6d7f86]/35 bg-[#6d7f86]/12 text-[#d7dfe2]">
                {me?.org?.name || 'Authority workspace'}
              </ToneBadge>
              <button
                type="button"
                onClick={handleExport}
                disabled={!selectedExportIds.length}
                className="inline-flex items-center gap-2 rounded-full border border-[#d7b667]/45 bg-[#d7b667]/14 px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#f4deb2] transition hover:bg-[#d7b667]/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={15} />
                Export {selectedExportIds.length || ''} packet{selectedExportIds.length === 1 ? '' : 's'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-[#4e4534] bg-[#100d09] px-4 py-2 text-sm font-medium uppercase tracking-[0.14em] text-[#ece2cc] transition hover:border-[#d7b667]/35 hover:text-[#f2dab0]"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          </div>

          {exportUrl && (
            <div className="mt-4 rounded-[18px] border border-[#92a16d]/35 bg-[#92a16d]/12 px-4 py-3 text-sm text-[#dce8c3]">
              Case packet exported.{' '}
              <a href={exportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold underline decoration-[#dce8c3]/40 underline-offset-4">
                Open packet
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-[18px] border border-[#ad5242]/35 bg-[#ad5242]/10 px-4 py-3 text-sm text-[#efc4bc]">
              {error}
            </div>
          )}
        </header>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="authority-panel flex min-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-[30px]">
            <div className="border-b border-[#4c4332] px-4 py-4">
              <p className="authority-label text-[10px] text-[#948973]">Sweep controls</p>
              <div className="mt-3 grid gap-3">
                <label className="text-sm text-[#cfc4ae]">
                  <span className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8f846d]">
                    <Search size={12} />
                    Search
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="ref, song, venue, city"
                    className="w-full rounded-2xl border border-[#4d4433] bg-[#0e0b08] px-4 py-3 text-[#f5ecd7] outline-none placeholder:text-[#756b58]"
                  />
                </label>

                <div className="grid gap-3">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="rounded-2xl border border-[#4d4433] bg-[#0e0b08] px-4 py-3 text-sm text-[#f5ecd7] outline-none"
                  >
                    <option value="">All analyst states</option>
                    <option value="unreviewed">Unreviewed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="rejected">Rejected</option>
                    <option value="needs_manual_venue_match">Needs venue match</option>
                  </select>
                  <select
                    value={qualityFilter}
                    onChange={(event) => setQualityFilter(event.target.value)}
                    className="rounded-2xl border border-[#4d4433] bg-[#0e0b08] px-4 py-3 text-sm text-[#f5ecd7] outline-none"
                  >
                    <option value="">All quality bands</option>
                    <option value="strong">Prime</option>
                    <option value="good">Stable</option>
                    <option value="review">Review</option>
                    <option value="weak">Fragile</option>
                  </select>
                  <select
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value)}
                    className="rounded-2xl border border-[#4d4433] bg-[#0e0b08] px-4 py-3 text-sm text-[#f5ecd7] outline-none"
                  >
                    <option value="">All source classes</option>
                    {sourceBreakdown.map((entry) => (
                      <option key={entry.key} value={entry.key}>{entry.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 border-b border-[#4c4332]">
              {SIDEBAR_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedSidebarTab(tab.key)}
                  className={`authority-label px-3 py-3 text-[10px] transition ${
                    selectedSidebarTab === tab.key
                      ? 'border-b-2 border-[#d7b667] bg-[#17120d] text-[#f4deb2]'
                      : 'text-[#8f846d] hover:text-[#f5ecd7]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="authority-scrollbar flex-1 overflow-y-auto p-4">
              {selectedSidebarTab === 'queue' && (
                <div className="space-y-3">
                  {filteredReports.map((report) => (
                    <QueueItem
                      key={report.id}
                      report={report}
                      isSelected={effectiveSelectedReport?.id === report.id}
                      isChecked={selectedExportIds.includes(report.id)}
                      onSelect={() => {
                        setSelectedReportId(report.id);
                        setSelectedVenueKey(report.targetVenueKey);
                      }}
                      onToggle={() => setSelectedExportIds((current) => (
                        current.includes(report.id)
                          ? current.filter((entry) => entry !== report.id)
                          : [...new Set([...current, report.id])]
                      ))}
                    />
                  ))}

                  {!filteredReports.length && (
                    <div className="rounded-[20px] border border-dashed border-[#4f4535] bg-[#17130f] px-4 py-6 text-sm text-[#a59881]">
                      No packets match the current sweep filters.
                    </div>
                  )}
                </div>
              )}

              {selectedSidebarTab === 'venues' && (
                <div className="space-y-3">
                  {venueStats.map((venue, index) => (
                    <LeaderboardItem
                      key={venue.key}
                      rank={index + 1}
                      title={venue.venueName}
                      subtitle={`${venue.city} • ${venue.priorityBand === 'immediate_action' ? 'Immediate action' : venue.priorityBand === 'watchlist' ? 'Watchlist' : 'Parked'} • ${formatInr(venue.estimatedRecoverableValueInr)}`}
                      value={`${venue.targetScore}`}
                      ratio={venue.targetScore / topVenueMax}
                      active={activeVenue?.key === venue.key}
                      onClick={() => {
                        setSelectedVenueKey(venue.key);
                        if (venue.reports[0]) {
                          setSelectedReportId(venue.reports[0].id);
                        }
                        setSelectedMainTab('geo');
                      }}
                    />
                  ))}
                </div>
              )}

              {selectedSidebarTab === 'songs' && (
                <div className="space-y-3">
                  {songStats.map((song, index) => (
                    <LeaderboardItem
                      key={song.key}
                      rank={index + 1}
                      title={song.title}
                      subtitle={`${song.artist} • ${song.venueCount} venues`}
                      value={song.count}
                      ratio={song.count / topSongMax}
                      onClick={() => setSearchQuery(song.title)}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main className="authority-panel flex min-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-[30px]">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#4c4332] px-4 py-3 sm:px-5">
              {MAIN_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedMainTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium uppercase tracking-[0.14em] transition ${
                    selectedMainTab === tab.key
                      ? 'border border-[#d7b667]/45 bg-[#d7b667]/14 text-[#f4deb2]'
                      : 'border border-transparent text-[#938873] hover:text-[#f5ecd7]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="authority-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
              {selectedMainTab === 'overview' && (
                <div className="space-y-5">
                  <SectionHeader
                    eyebrow="IPRS command layer"
                    title="Enforcement triage and targeting"
                    helper="Apply integrity, evidence, and rights gates before routing venues into immediate action, watchlist campaigns, or parked analysis."
                  />

                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    {overviewMetrics.map((metric) => (
                      <StatCard key={metric.label} {...metric} />
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="authority-panel rounded-[26px] p-5">
                      <SectionHeader
                        eyebrow="Venue target ladder"
                        title="IPRS target score"
                        helper="Weighted by recoverable value, repeat pressure, evidence confidence, venue scale, recency, contributor trust, analyst override, and the new AI attack-readiness / edge-case risk layer."
                      />
                      <div className="mt-4 space-y-3">
                        {topTargetVenues.map((venue, index) => (
                          <div key={venue.key} className="rounded-[20px] border border-[#4c4332] bg-[#18130f] px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="authority-data text-xs text-[#9f947c]">#{index + 1}</span>
                                  <p className="text-sm font-medium text-[#f5ecd7]">{venue.venueName}</p>
                                  <IprsPriorityBadge band={venue.priorityBand} />
                                </div>
                                <p className="mt-2 text-xs text-[#a89d87]">{venue.city} • {formatInr(venue.estimatedRecoverableValueInr)} recoverable</p>
                              </div>
                              <div className="text-right">
                                <p className="authority-data text-2xl text-[#f5ecd7]">{venue.targetScore}</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-[#8f846d]">Target score</p>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                                {venue.actionableCount} actionable
                              </ToneBadge>
                              <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                                {venue.provisionalCount} provisional
                              </ToneBadge>
                              <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                                {venue.repeatPressure} repeat pressure
                              </ToneBadge>
                            </div>
                          </div>
                        ))}

                        {!topTargetVenues.length && (
                          <div className="rounded-[20px] border border-dashed border-[#4f4535] bg-[#17130f] px-4 py-6 text-sm text-[#a59881]">
                            No venue entities are available for IPRS scoring in the current sweep.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="authority-panel rounded-[26px] p-5">
                      <SectionHeader
                        eyebrow="Case funnel"
                        title="Gate clearance"
                        helper="Strict IPRS automation is intentionally conservative. Current packets only become actionable after all three gates clear."
                      />
                      <div className="mt-5 space-y-4">
                        <CoverageRow label="Integrity gate cleared" count={iprsCaseSummary.integrityPass} ratio={iprsCaseSummary.integrityPass / (totalVisibleReports || 1)} />
                        <CoverageRow label="Evidence gate cleared" count={iprsCaseSummary.evidencePass} ratio={iprsCaseSummary.evidencePass / (totalVisibleReports || 1)} />
                        <CoverageRow label="Rights gate cleared" count={iprsCaseSummary.rightsPass} ratio={iprsCaseSummary.rightsPass / (totalVisibleReports || 1)} />
                        <CoverageRow label="Actionable cases" count={iprsCaseSummary.actionable} ratio={iprsCaseSummary.actionable / (totalVisibleReports || 1)} />
                        <CoverageRow label="Provisional cases" count={iprsCaseSummary.provisional} ratio={iprsCaseSummary.provisional / (totalVisibleReports || 1)} />
                        <CoverageRow label="Rejected packets" count={iprsCaseSummary.rejected} ratio={iprsCaseSummary.rejected / (totalVisibleReports || 1)} />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                    <div className="authority-panel rounded-[26px] p-5">
                      <SectionHeader
                        eyebrow="Temporal load"
                        title="Packet intake over time"
                        helper="Daily visible packet volume and cumulative recoverable value."
                      />
                      <div className="mt-4 min-w-0">
                        <ResponsiveContainer width="100%" height={280} minWidth={0}>
                          <AreaChart data={timelineSeries}>
                            <defs>
                              <linearGradient id="packetReportsFill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="5%" stopColor="#d7b667" stopOpacity={0.42} />
                                <stop offset="95%" stopColor="#d7b667" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgba(92,82,63,0.45)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: '#9e9278', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#9e9278', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                              type="monotone"
                              dataKey="reports"
                              name="Packets"
                              stroke="#d7b667"
                              strokeWidth={2}
                              fill="url(#packetReportsFill)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="authority-panel rounded-[26px] p-5">
                      <SectionHeader
                        eyebrow="Coverage lattice"
                        title="Evidence package coverage"
                        helper="How many visible packets actually populate each packet section."
                      />
                      <div className="mt-5 space-y-4">
                        {coverageSeries.map((entry) => (
                          <CoverageRow key={entry.label} label={entry.label} count={entry.count} ratio={entry.ratio} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="authority-panel rounded-[26px] p-5">
                      <SectionHeader
                        eyebrow="Integrity watch"
                        title="Alert ledger"
                        helper="Priority flags across the current evidence sweep."
                      />
                      <div className="mt-4 space-y-3">
                        {integrityAlerts.map((alert) => (
                          <div key={alert.key} className="flex items-center justify-between gap-4 rounded-[20px] border border-[#4c4332] bg-[#18130f] px-4 py-3">
                            <div className="flex items-center gap-3">
                              {alert.tone === 'pass' ? (
                                <CheckCircle2 size={16} className="text-[#cfe1a9]" />
                              ) : (
                                <AlertTriangle size={16} className="text-[#efc4bc]" />
                              )}
                              <span className="text-sm text-[#d8ceb9]">{alert.label}</span>
                            </div>
                            <span className="authority-data text-sm text-[#f5ecd7]">{alert.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="authority-panel rounded-[26px] p-5">
                        <SectionHeader eyebrow="Signal profile" title="Source-class split" />
                        <div className="mt-4 min-w-0">
                          <ResponsiveContainer width="100%" height={240} minWidth={0}>
                            <PieChart>
                              <Pie
                                data={sourceBreakdown}
                                dataKey="value"
                                nameKey="label"
                                innerRadius={48}
                                outerRadius={82}
                                paddingAngle={2}
                              >
                                {sourceBreakdown.map((entry, index) => (
                                  <Cell key={entry.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-4 space-y-2">
                          {sourceBreakdown.map((entry, index) => (
                            <div key={entry.key} className="flex items-center justify-between gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                <span className="text-[#cfc4ae]">{entry.label}</span>
                              </div>
                              <span className="authority-data text-[#f5ecd7]">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="authority-panel rounded-[26px] p-5">
                        <SectionHeader eyebrow="Audio confidence" title="Confidence buckets" />
                        <div className="mt-4 min-w-0">
                          <ResponsiveContainer width="100%" height={240} minWidth={0}>
                            <BarChart data={confidenceBuckets}>
                              <CartesianGrid stroke="rgba(92,82,63,0.45)" vertical={false} />
                              <XAxis dataKey="label" tick={{ fill: '#9e9278', fontSize: 11 }} axisLine={false} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{ fill: '#9e9278', fontSize: 11 }} axisLine={false} tickLine={false} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="count" name="Packets" radius={[8, 8, 0, 0]} fill="#92a16d" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedMainTab === 'geo' && (
                <div className="space-y-5">
                  <SectionHeader
                    eyebrow="Venue map"
                    title="Venue hotzones and coordinate sweep"
                    helper="Map every reported venue on Google Maps, inspect venue density, and drill into the active venue dossier."
                  />

                  <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
                    <AuthorityVenueMap
                      venues={venueStats}
                      selectedVenueKey={activeVenue?.key || ''}
                      onSelectVenue={setSelectedVenueKey}
                      selectedReportId={effectiveSelectedReport?.id || ''}
                    />

                    <div className="space-y-4">
                      <div className="authority-panel rounded-[26px] p-5">
                        <SectionHeader eyebrow="City heat" title="City load" />
                        <div className="mt-4 space-y-3">
                          {cityStats.map((entry) => (
                            <div key={entry.city}>
                              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                                <span className="text-[#d6ccb7]">{entry.city}</span>
                                <span className="authority-data text-[#f5ecd7]">{entry.count}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-[#322b20]">
                                <div className="h-2 rounded-full bg-[#6d7f86]" style={{ width: `${Math.round((entry.count / Math.max(cityStats[0]?.count || 1, 1)) * 100)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="authority-panel rounded-[26px] p-5">
                        <SectionHeader
                          eyebrow="Selected venue"
                          title={activeVenue?.venueName || 'No venue selected'}
                          helper={activeVenue ? `${activeVenue.city} • ${formatCoords({ lat: activeVenue.lat, lon: activeVenue.lon })} • score ${activeVenue.targetScore}` : 'Select a mapped venue to inspect its dossier.'}
                          action={activeVenue ? <IprsPriorityBadge band={activeVenue.priorityBand} /> : null}
                        />
                        {activeVenue ? (
                          <div className="mt-5 space-y-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <StatCard label="Target score" value={activeVenue.targetScore} helper={activeVenue.priorityBand === 'immediate_action' ? 'Immediate-action candidate' : activeVenue.priorityBand === 'watchlist' ? 'Watchlist candidate' : 'Parked'} icon={MapPinned} />
                              <StatCard label="Packets" value={activeVenue.reportCount} helper="Visible packets in sweep" icon={FileSearch} />
                              <StatCard label="Avg quality" value={`${activeVenue.averageQuality}/100`} helper={QUALITY_META[activeVenue.qualityBand].label} icon={ShieldCheck} />
                            </div>
                            <div className="rounded-[20px] border border-[#4b4232] bg-[#17120e] p-4">
                              <MetaRow label="Recoverable" value={formatInr(activeVenue.estimatedRecoverableValueInr)} />
                              <MetaRow label="Actionable / provisional" value={`${activeVenue.actionableCount} / ${activeVenue.provisionalCount}`} />
                              <MetaRow label="Attack ready / corroborate" value={`${activeVenue.attackReadyCount} / ${activeVenue.corroborationCount}`} />
                              <MetaRow label="Avg attack readiness" value={formatPercent(activeVenue.averageAttackReadiness)} />
                              <MetaRow label="Avg edge-case risk" value={formatPercent(activeVenue.averageApplicationRisk)} />
                              <MetaRow label="Reviewed" value={activeVenue.reviewedCount} />
                              <MetaRow label="Merchant linked" value={activeVenue.merchantLinkedCount} />
                              <MetaRow label="Latest packet" value={formatDateTime(activeVenue.latestAt)} />
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-[#a89d87]">No venue dossier is available.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedMainTab === 'packet' && (
                <div className="space-y-5">
                  <SectionHeader
                    eyebrow="Evidence packet"
                    title={effectiveSelectedReport ? `${effectiveSelectedReport.reference} // ${effectiveSelectedReport.title}` : 'No packet selected'}
                    helper={effectiveSelectedReport ? `${effectiveSelectedReport.artist} • ${effectiveSelectedReport.venueName} • ${effectiveSelectedReport.city}` : 'Select a packet from the left queue to inspect every evidence-package section.'}
                  />

                  {effectiveSelectedReport ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <StatCard label="Match confidence" value={`${Math.round(effectiveSelectedReport.matchConfidence * 100)}%`} helper={humanizeToken(effectiveSelectedReport.sourceClass || 'missing')} icon={AudioLines} />
                        <StatCard label="Recoverable" value={formatInr(effectiveSelectedReport.estimatedRecoverableValueInr)} helper={humanizeToken(effectiveSelectedReport.licenseStatus)} icon={Landmark} />
                        <StatCard label="IPRS stage" value={humanizeToken(effectiveSelectedReport.iprs.caseStage)} helper={`${effectiveSelectedReport.iprs.blockers.length} blocker${effectiveSelectedReport.iprs.blockers.length === 1 ? '' : 's'}`} icon={Fingerprint} />
                        <StatCard label="Packet tier" value={`${effectiveSelectedReport.qualityScore}/100`} helper={QUALITY_META[effectiveSelectedReport.qualityBand].label} icon={ShieldAlert} />
                      </div>

                      <div className="authority-panel rounded-[26px] p-5">
                        <SectionHeader
                          eyebrow="IPRS triage"
                          title="Actionability gates"
                          helper="Strict automated triage before legal notice, raid scheduling, or settlement outreach."
                          action={<IprsStageBadge stage={effectiveSelectedReport.iprs.caseStage} />}
                        />
                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          <div className="rounded-[22px] border border-[#4c4332] bg-[#18130f] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-medium text-[#f5ecd7]">Integrity gate</h3>
                              <IprsGateBadge pass={effectiveSelectedReport.iprs.integrityPass} />
                            </div>
                            <div className="mt-4 space-y-3">
                              {effectiveSelectedReport.iprs.integrityChecks.map((check) => (
                                <div key={check.label} className="rounded-[16px] border border-[#4c4332] bg-[#120f0b] px-3 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-[#f2e9d5]">{check.label}</p>
                                    <IprsGateBadge pass={check.pass} />
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-[#aa9f89]">{check.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-[22px] border border-[#4c4332] bg-[#18130f] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-medium text-[#f5ecd7]">Evidence gate</h3>
                              <IprsGateBadge pass={effectiveSelectedReport.iprs.evidencePass} />
                            </div>
                            <div className="mt-4 space-y-3">
                              {effectiveSelectedReport.iprs.evidenceChecks.map((check) => (
                                <div key={check.label} className="rounded-[16px] border border-[#4c4332] bg-[#120f0b] px-3 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-[#f2e9d5]">{check.label}</p>
                                    <IprsGateBadge pass={check.pass} />
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-[#aa9f89]">{check.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-[22px] border border-[#4c4332] bg-[#18130f] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-medium text-[#f5ecd7]">Rights gate</h3>
                              <IprsGateBadge pass={effectiveSelectedReport.iprs.rightsPass} />
                            </div>
                            <div className="mt-4 space-y-3">
                              {effectiveSelectedReport.iprs.rightsChecks.map((check) => (
                                <div key={check.label} className="rounded-[16px] border border-[#4c4332] bg-[#120f0b] px-3 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-[#f2e9d5]">{check.label}</p>
                                    <IprsGateBadge pass={check.pass} />
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-[#aa9f89]">{check.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[20px] border border-[#4c4332] bg-[#17120e] p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                              {Math.round(effectiveSelectedReport.iprs.evidenceStrength * 100)} evidence strength
                            </ToneBadge>
                            <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                              {Math.round(effectiveSelectedReport.iprs.geoVenueDistanceMeters ?? 0)} m venue delta
                            </ToneBadge>
                            <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                              {humanizeToken(effectiveSelectedReport.iprs.trustBand)}
                            </ToneBadge>
                          </div>
                          <div className="mt-4">
                            <p className="authority-label text-[10px] text-[#9e9278]">Current blockers</p>
                            {effectiveSelectedReport.iprs.blockers.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {effectiveSelectedReport.iprs.blockers.map((blocker) => (
                                  <ToneBadge key={blocker} toneClass="border-[#ad5242]/35 bg-[#ad5242]/12 text-[#efc4bc]">
                                    {blocker}
                                  </ToneBadge>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-[#d9e7bf]">No blockers remain. This packet clears the current IPRS automation gates.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="authority-panel rounded-[26px] p-5">
                        <SectionHeader
                          eyebrow="AI application layer"
                          title="Edge-case adjudication"
                          helper="Structured venue-attribution triage layered over the captured geo, source, visual, radio, and install-history signals."
                          action={<ApplicationDispositionBadge disposition={effectiveSelectedReport.applicationDisposition} />}
                        />

                        {effectiveSelectedReport.application ? (
                          <>
                            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <StatCard
                                label="Attack readiness"
                                value={formatPercent(effectiveSelectedReport.application.attackReadiness)}
                                helper={humanizeToken(effectiveSelectedReport.locationContext)}
                                icon={ShieldCheck}
                              />
                              <StatCard
                                label="Venue risk"
                                value={formatPercent(effectiveSelectedReport.application.venueAttributionRisk)}
                                helper={humanizeToken(effectiveSelectedReport.application.signalSummary?.geoBucket || 'unknown')}
                                icon={MapPinned}
                              />
                              <StatCard
                                label="Private / replay"
                                value={formatPercent(Math.max(
                                  Number(effectiveSelectedReport.application.privateSpaceRisk || 0),
                                  Number(effectiveSelectedReport.application.replayRisk || 0),
                                ))}
                                helper={`${formatPercent(effectiveSelectedReport.application.privateSpaceRisk)} private / ${formatPercent(effectiveSelectedReport.application.replayRisk)} replay`}
                                icon={ShieldAlert}
                              />
                              <StatCard
                                label="Outlet / farming"
                                value={formatPercent(Math.max(
                                  Number(effectiveSelectedReport.application.outletAmbiguityRisk || 0),
                                  Number(effectiveSelectedReport.application.farmingRisk || 0),
                                ))}
                                helper={`${formatPercent(effectiveSelectedReport.application.outletAmbiguityRisk)} outlet / ${formatPercent(effectiveSelectedReport.application.farmingRisk)} farming`}
                                icon={Fingerprint}
                              />
                            </div>

                            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                              <div className="rounded-[22px] border border-[#4c4332] bg-[#18130f] p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                                    {humanizeToken(effectiveSelectedReport.application.locationContext)}
                                  </ToneBadge>
                                  <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                                    {formatPercent(effectiveSelectedReport.application.confidence)} confidence
                                  </ToneBadge>
                                  <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                                    {effectiveSelectedReport.application.modelVersion || 'application-v1'}
                                  </ToneBadge>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  <div className="rounded-[18px] border border-[#4c4332] bg-[#120f0b] px-4 py-3">
                                    <p className="authority-label text-[10px] text-[#9e9278]">Reasons</p>
                                    <div className="mt-3 space-y-2 text-sm text-[#d8ceb9]">
                                      {effectiveSelectedReport.application.reasons?.length ? effectiveSelectedReport.application.reasons.map((reason) => (
                                        <p key={reason}>{reason}</p>
                                      )) : (
                                        <p>No adjudication reasons were attached.</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-[18px] border border-[#4c4332] bg-[#120f0b] px-4 py-3">
                                    <p className="authority-label text-[10px] text-[#9e9278]">Evidence gaps</p>
                                    <div className="mt-3 space-y-2 text-sm text-[#d8ceb9]">
                                      {effectiveSelectedReport.application.evidenceGaps?.length ? effectiveSelectedReport.application.evidenceGaps.map((gap) => (
                                        <p key={gap}>{gap}</p>
                                      )) : (
                                        <p>No major gaps were surfaced by the adjudication layer.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-[22px] border border-[#4c4332] bg-[#18130f] p-4">
                                <p className="authority-label text-[10px] text-[#9e9278]">Risk tags and signals</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {(effectiveSelectedReport.application.edgeCaseTags || []).length ? effectiveSelectedReport.application.edgeCaseTags.map((tag) => (
                                    <ToneBadge key={tag} toneClass="border-[#4c4332] bg-[#120f0b] text-[#f5ecd7]">
                                      {humanizeToken(tag)}
                                    </ToneBadge>
                                  )) : (
                                    <ToneBadge toneClass="border-[#4c4332] bg-[#120f0b] text-[#cfc4ae]">
                                      No edge-case tags
                                    </ToneBadge>
                                  )}
                                </div>

                                <div className="mt-4 rounded-[18px] border border-[#4c4332] bg-[#120f0b] px-4">
                                  <MetaRow label="Geo bucket" value={humanizeToken(effectiveSelectedReport.application.signalSummary?.geoBucket)} />
                                  <MetaRow label="Primary venue source" value={humanizeToken(effectiveSelectedReport.application.signalSummary?.primaryVenueSource)} />
                                  <MetaRow label="Venue delta" value={effectiveSelectedReport.application.signalSummary?.geoDistanceMeters != null ? `${Math.round(effectiveSelectedReport.application.signalSummary.geoDistanceMeters)} m` : 'n/a'} />
                                  <MetaRow label="Capture path delta" value={formatMeters(effectiveSelectedReport.application.signalSummary?.capturePathDeltaMeters)} />
                                  <MetaRow label="Venue anchor delta" value={formatMeters(effectiveSelectedReport.application.signalSummary?.venueAnchorDeltaMeters)} />
                                  <MetaRow label="GPS accuracy" value={effectiveSelectedReport.application.signalSummary?.averageAccuracyMeters != null ? `${Math.round(effectiveSelectedReport.application.signalSummary.averageAccuracyMeters)} m` : 'n/a'} />
                                  <MetaRow label="Within accuracy envelope" value={effectiveSelectedReport.application.signalSummary?.withinAccuracyEnvelope == null ? 'n/a' : effectiveSelectedReport.application.signalSummary?.withinAccuracyEnvelope ? 'Yes' : 'No'} />
                                  <MetaRow label="Selected / matched" value={effectiveSelectedReport.application.signalSummary?.selectedMatchedAligned ? 'Aligned' : 'Unclear'} />
                                  <MetaRow label="Venue cues" value={effectiveSelectedReport.application.signalSummary?.venueCueCount ?? 0} />
                                  <MetaRow label="Wi-Fi connected" value={effectiveSelectedReport.application.signalSummary?.wifiConnected ? 'Yes' : 'No'} />
                                  <MetaRow label="Source class" value={humanizeToken(effectiveSelectedReport.application.signalSummary?.sourceClass)} />
                                  <MetaRow label="Visual playback" value={humanizeToken(effectiveSelectedReport.application.signalSummary?.visualPlaybackContext)} />
                                  <MetaRow label="Install weak reports (30d)" value={effectiveSelectedReport.application.signalSummary?.sameInstallWeakReports30d ?? 0} />
                                  <MetaRow label="Install venue spread (30d)" value={effectiveSelectedReport.application.signalSummary?.sameInstallDistinctVenues30d ?? 0} />
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="mt-4 rounded-[20px] border border-dashed border-[#4d4433] bg-[#17120e] px-4 py-5 text-sm text-[#a59881]">
                            No adjudication payload is attached to this packet.
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="authority-panel rounded-[26px] p-5">
                          <SectionHeader eyebrow="1. Capture integrity" title="Chain of custody" />
                          <div className="mt-4 rounded-[20px] border border-[#4c4332] bg-[#18130f] px-4">
                            <MetaRow label="Submission ref" value={effectiveSelectedReport.capture?.submissionReference || 'n/a'} mono />
                            <MetaRow label="Capture session" value={effectiveSelectedReport.capture?.captureSessionId || 'n/a'} mono />
                            <MetaRow label="Origin surface" value={humanizeToken(effectiveSelectedReport.capture?.originSurface)} />
                            <MetaRow label="Consent version" value={effectiveSelectedReport.capture?.consentVersion || 'n/a'} />
                            <MetaRow label="Duration" value={`${effectiveSelectedReport.durationSeconds || 0}s`} />
                            <MetaRow label="Media hash" value={effectiveSelectedReport.capture?.mediaSha256 || 'n/a'} mono />
                            <MetaRow label="Signature" value={humanizeToken(effectiveSelectedReport.signatureStatus)} />
                            <MetaRow label="Clock skew" value={humanizeToken(effectiveSelectedReport.clockSkewStatus)} />
                            <MetaRow label="Start offset" value={`${effectiveSelectedReport.capture?.measuredOffsetsMs?.start ?? 'n/a'} ms`} />
                            <MetaRow label="End offset" value={`${effectiveSelectedReport.capture?.measuredOffsetsMs?.end ?? 'n/a'} ms`} />
                            <MetaRow label="Device model" value={effectiveSelectedReport.capture?.device?.model || 'n/a'} />
                            <MetaRow label="OS version" value={effectiveSelectedReport.capture?.device?.osVersion || 'n/a'} />
                            <MetaRow label="App version" value={effectiveSelectedReport.capture?.device?.appVersion || 'n/a'} />
                            <MetaRow label="Trust band" value={effectiveSelectedReport.capture?.device?.deviceTrustBand || 'n/a'} />
                            <MetaRow label="Local start" value={formatDateTime(effectiveSelectedReport.capture?.timestamps?.localStartTime)} />
                            <MetaRow label="Local end" value={formatDateTime(effectiveSelectedReport.capture?.timestamps?.localEndTime)} />
                            <MetaRow label="Processing done" value={formatDateTime(effectiveSelectedReport.capture?.timestamps?.processingCompletedAt)} />
                            <MetaRow label="Start coordinates" value={formatCoords(effectiveSelectedReport.capture?.geolocation?.start)} />
                            <MetaRow label="End coordinates" value={formatCoords(effectiveSelectedReport.capture?.geolocation?.end)} />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            {effectiveSelectedReport.capture?.assets?.rawVideo?.url && (
                              <AssetLink
                                href={effectiveSelectedReport.capture.assets.rawVideo.url}
                                toneClass="border-[#d7b667]/35 bg-[#d7b667]/10 text-[#f2dab0]"
                              >
                                Open raw video
                              </AssetLink>
                            )}
                            {effectiveSelectedReport.capture?.assets?.derivedAudio?.url && (
                              <AssetLink
                                href={effectiveSelectedReport.capture.assets.derivedAudio.url}
                                toneClass="border-[#92a16d]/35 bg-[#92a16d]/10 text-[#d9e7bf]"
                              >
                                Open derived audio
                              </AssetLink>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="authority-panel rounded-[26px] p-5">
                            <SectionHeader eyebrow="2. Audio identification" title="Track identity" />
                            <div className="mt-4 rounded-[20px] border border-[#4c4332] bg-[#18130f] px-4">
                              <MetaRow label="Provider" value={effectiveSelectedReport.audio?.provider || 'n/a'} />
                              <MetaRow label="Matched song" value={effectiveSelectedReport.audio?.matchedSong || 'n/a'} />
                              <MetaRow label="Title" value={effectiveSelectedReport.audio?.title || 'n/a'} />
                              <MetaRow label="Artist" value={effectiveSelectedReport.audio?.artist || 'n/a'} />
                              <MetaRow label="Label" value={effectiveSelectedReport.audio?.label || 'n/a'} />
                              <MetaRow label="Album" value={effectiveSelectedReport.audio?.album || 'n/a'} />
                              <MetaRow label="Release date" value={effectiveSelectedReport.audio?.releaseDate || 'n/a'} />
                              <MetaRow label="ISRC" value={effectiveSelectedReport.audio?.isrc || 'n/a'} mono />
                              <MetaRow label="UPC" value={effectiveSelectedReport.audio?.upc || 'n/a'} mono />
                              <MetaRow label="Track confidence" value={`${Math.round(effectiveSelectedReport.matchConfidence * 100)}%`} />
                            </div>
                          </div>

                          <div className="authority-panel rounded-[26px] p-5">
                            <SectionHeader eyebrow="3. Venue and rights" title="Venue context" />
                            <div className="mt-4 rounded-[20px] border border-[#4c4332] bg-[#18130f] px-4">
                              <MetaRow label="Selected venue" value={effectiveSelectedReport.selectedVenue?.name || 'n/a'} />
                              <MetaRow label="Matched venue" value={effectiveSelectedReport.matchedVenue?.name || 'n/a'} />
                              <MetaRow label="Primary delta source" value={humanizeToken(effectiveSelectedReport.locationDelta?.primaryVenueSource || 'none')} />
                              <MetaRow label="Geo bucket" value={humanizeToken(effectiveSelectedReport.locationDelta?.geoBucket || 'unknown')} />
                              <MetaRow label="Selected venue delta" value={`start ${formatMeters(effectiveSelectedReport.locationDelta?.selectedVenueDistanceStartMeters)} / end ${formatMeters(effectiveSelectedReport.locationDelta?.selectedVenueDistanceEndMeters)}`} />
                              <MetaRow label="Matched venue delta" value={`start ${formatMeters(effectiveSelectedReport.locationDelta?.matchedVenueDistanceStartMeters)} / end ${formatMeters(effectiveSelectedReport.locationDelta?.matchedVenueDistanceEndMeters)}`} />
                              <MetaRow label="Min / avg / max venue delta" value={`${formatMeters(effectiveSelectedReport.locationDelta?.minVenueDistanceMeters)} / ${formatMeters(effectiveSelectedReport.locationDelta?.avgVenueDistanceMeters)} / ${formatMeters(effectiveSelectedReport.locationDelta?.maxVenueDistanceMeters)}`} />
                              <MetaRow label="Capture path delta" value={formatMeters(effectiveSelectedReport.locationDelta?.capturePathDeltaMeters)} />
                              <MetaRow label="Venue anchor delta" value={formatMeters(effectiveSelectedReport.locationDelta?.venueAnchorDeltaMeters)} />
                              <MetaRow label="GPS accuracy start / end" value={`${formatMeters(effectiveSelectedReport.locationDelta?.accuracyStartMeters)} / ${formatMeters(effectiveSelectedReport.locationDelta?.accuracyEndMeters)}`} />
                              <MetaRow label="Accuracy envelope" value={effectiveSelectedReport.locationDelta?.accuracyEnvelopeMeters != null ? `${formatMeters(effectiveSelectedReport.locationDelta?.accuracyEnvelopeMeters)} (${effectiveSelectedReport.locationDelta?.withinAccuracyEnvelope ? 'within' : 'outside'})` : 'n/a'} />
                              <MetaRow label="City" value={effectiveSelectedReport.city} />
                              <MetaRow label="Merchant entity" value={effectiveSelectedReport.merchant?.legalEntityName || effectiveSelectedReport.merchant?.venueName || 'n/a'} />
                              <MetaRow label="GSTIN" value={effectiveSelectedReport.merchant?.gstin || 'n/a'} mono />
                              <MetaRow label="Venue type" value={humanizeToken(effectiveSelectedReport.merchant?.venueType)} />
                              <MetaRow label="City tier" value={humanizeToken(effectiveSelectedReport.merchant?.cityTier)} />
                              <MetaRow label="30 / 90 day history" value={`${effectiveSelectedReport.venueHistory?.reports30Days ?? 0} / ${effectiveSelectedReport.venueHistory?.reports90Days ?? 0}`} />
                              <MetaRow label="Rights org" value={effectiveSelectedReport.rightsOrg || 'n/a'} />
                              <MetaRow label="License state" value={humanizeToken(effectiveSelectedReport.licenseStatus)} />
                              <MetaRow label="Case ref" value={effectiveSelectedReport.caseView?.reference || 'n/a'} mono />
                              <MetaRow label="Case status" value={humanizeToken(effectiveSelectedReport.caseView?.caseStatus)} />
                              <MetaRow label="Recoverable" value={formatInr(effectiveSelectedReport.estimatedRecoverableValueInr)} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4">
                          <div className="authority-panel rounded-[26px] p-5">
                            <SectionHeader eyebrow="4. Source assessment" title="Classifier and signal metrics" />
                            <div className="mt-4 flex flex-wrap gap-2">
                              <QualityBadge band={effectiveSelectedReport.qualityBand} />
                              <ToneBadge toneClass="border-[#4d4433] bg-[#1a150f] text-[#f5ecd7]">
                                {humanizeToken(effectiveSelectedReport.sourceClass || 'missing')}
                              </ToneBadge>
                              <ToneBadge toneClass="border-[#4d4433] bg-[#1a150f] text-[#f5ecd7]">
                                {formatPercent(effectiveSelectedReport.sourceConfidence)}
                              </ToneBadge>
                              <ToneBadge toneClass="border-[#4d4433] bg-[#1a150f] text-[#f5ecd7]">
                                {effectiveSelectedReport.source?.modelVersion || 'n/a'}
                              </ToneBadge>
                            </div>

                            {!!effectiveSelectedReport.source?.explanation?.length && (
                              <div className="mt-4 space-y-2">
                                {effectiveSelectedReport.source.explanation.map((entry) => (
                                  <div key={entry} className="rounded-[18px] border border-[#4d4433] bg-[#17120e] px-4 py-3 text-sm text-[#d7cdb8]">
                                    {entry}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {Object.entries(effectiveSelectedReport.sourceSignals).map(([key, value]) => (
                                <div key={key} className="rounded-[18px] border border-[#4d4433] bg-[#17120e] px-4 py-3">
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-xs text-[#aa9f89]">{humanizeToken(key)}</span>
                                    <span className="authority-data text-sm text-[#f5ecd7]">{formatMaybeNumber(value, 3)}</span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-[#30291e]">
                                    <div
                                      className="h-1.5 rounded-full bg-[#92a16d]"
                                      style={{ width: `${Math.max(6, Math.min(100, Math.round(Math.abs(Number(value) || 0) * 100)))}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                              {!Object.keys(effectiveSelectedReport.sourceSignals).length && (
                                <div className="rounded-[18px] border border-dashed border-[#4d4433] bg-[#17120e] px-4 py-4 text-sm text-[#a59881]">
                                  No raw signal metrics were stored for this packet.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="authority-panel rounded-[26px] p-5">
                            <SectionHeader eyebrow="5. Radio context" title="Wi-Fi and Bluetooth context" />
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div className="rounded-[20px] border border-[#4d4433] bg-[#17120e] p-4">
                                <div className="flex items-center gap-2 text-[#d7b667]">
                                  <Wifi size={15} />
                                  <p className="authority-label text-[10px] text-[#9e9278]">Latest Wi-Fi context</p>
                                </div>
                                <div className="mt-3 space-y-3 text-sm text-[#d8ceb9]">
                                  <p>{effectiveSelectedReport.radio?.wifi?.summary || 'No Wi-Fi context captured.'}</p>
                                  <MetaRow label="Status" value={humanizeToken(effectiveSelectedReport.radio?.wifi?.status)} />
                                  <MetaRow label="SSID" value={effectiveSelectedReport.radio?.wifi?.ssid || 'n/a'} mono />
                                  <MetaRow label="BSSID" value={effectiveSelectedReport.radio?.wifi?.bssid || 'n/a'} mono />
                                  <MetaRow label="Frequency" value={effectiveSelectedReport.radio?.wifi?.frequency ? `${effectiveSelectedReport.radio.wifi.frequency} MHz` : 'n/a'} />
                                </div>
                              </div>

                              <div className="rounded-[20px] border border-[#4d4433] bg-[#17120e] p-4">
                                <div className="flex items-center gap-2 text-[#92a16d]">
                                  <Bluetooth size={15} />
                                  <p className="authority-label text-[10px] text-[#9e9278]">Latest Bluetooth context</p>
                                </div>
                                <div className="mt-3 space-y-3 text-sm text-[#d8ceb9]">
                                  <p>{effectiveSelectedReport.radio?.bluetooth?.summary || 'No Bluetooth context captured.'}</p>
                                  <MetaRow label="Status" value={humanizeToken(effectiveSelectedReport.radio?.bluetooth?.status)} />
                                  <MetaRow label="Nearby BLE devices" value={effectiveSelectedReport.radio?.bluetooth?.deviceCount ?? 0} />
                                  <MetaRow label="Support level" value={humanizeToken(effectiveSelectedReport.radio?.bluetooth?.supportLevel)} />
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div className="rounded-[20px] border border-[#4d4433] bg-[#17120e] p-4">
                                <p className="authority-label text-[10px] text-[#9e9278]">Recorder start snapshot</p>
                                <div className="mt-3 space-y-2 text-sm text-[#d7cdb8]">
                                  <p>Wi-Fi: {humanizeToken(effectiveSelectedReport.radioSnapshots?.start?.wifi?.status || 'missing')}</p>
                                  <p>Bluetooth: {humanizeToken(effectiveSelectedReport.radioSnapshots?.start?.bluetooth?.status || 'missing')}</p>
                                </div>
                              </div>
                              <div className="rounded-[20px] border border-[#4d4433] bg-[#17120e] p-4">
                                <p className="authority-label text-[10px] text-[#9e9278]">Recorder end snapshot</p>
                                <div className="mt-3 space-y-2 text-sm text-[#d7cdb8]">
                                  <p>Wi-Fi: {humanizeToken(effectiveSelectedReport.radioSnapshots?.end?.wifi?.status || 'missing')}</p>
                                  <p>Bluetooth: {humanizeToken(effectiveSelectedReport.radioSnapshots?.end?.bluetooth?.status || 'missing')}</p>
                                </div>
                              </div>
                            </div>

                            {!!effectiveSelectedReport.radioSnapshots?.limitations?.length && (
                              <div className="mt-4 rounded-[20px] border border-[#4d4433] bg-[#17120e] p-4">
                                <p className="authority-label text-[10px] text-[#9e9278]">Platform limitations</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {effectiveSelectedReport.radioSnapshots.limitations.map((entry) => (
                                    <ToneBadge key={entry} toneClass="border-[#4d4433] bg-[#120f0b] text-[#cfc4ae]">
                                      {humanizeToken(entry)}
                                    </ToneBadge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="authority-panel rounded-[26px] p-5">
                            <SectionHeader eyebrow="6. Visual context" title="Playback cues and frame evidence" />
                            <div className="mt-4 rounded-[20px] border border-[#4d4433] bg-[#17120e] px-4">
                              <MetaRow label="Playback context" value={humanizeToken(effectiveSelectedReport.playbackContext)} />
                              <MetaRow label="Visual confidence" value={effectiveSelectedReport.visual ? formatPercent(effectiveSelectedReport.visualConfidence) : 'n/a'} />
                              <MetaRow label="Model version" value={effectiveSelectedReport.visual?.modelVersion || 'n/a'} />
                              <MetaRow label="Peak windows" value={effectiveSelectedReport.visual?.peakWindows?.length ?? 0} />
                              <MetaRow label="Playback cues" value={selectedVisualCueBuckets.playbackCues.join(', ') || 'n/a'} />
                              <MetaRow label="Scene objects" value={selectedVisualCueBuckets.sceneObjects.join(', ') || 'n/a'} />
                              <MetaRow label="Venue cues" value={(effectiveSelectedReport.visual?.venueIdentitySignals || []).join(', ') || 'n/a'} />
                              <MetaRow label="Obstruction flags" value={(effectiveSelectedReport.visual?.obstructionFlags || []).join(', ') || 'n/a'} />
                            </div>

                            {effectiveSelectedReport.visual?.summary && (
                              <div className="mt-4 rounded-[20px] border border-[#4d4433] bg-[#17120e] px-4 py-4 text-sm leading-6 text-[#d6ccb7]">
                                {effectiveSelectedReport.visual.summary}
                              </div>
                            )}

                            {!!effectiveSelectedReport.visual?.frameObservations?.length && (
                              <div className="mt-4 space-y-3">
                                {effectiveSelectedReport.visual.frameObservations.map((entry) => (
                                  <div key={`${entry.timestampSeconds}-${entry.observation}`} className="rounded-[18px] border border-[#4d4433] bg-[#17120e] px-4 py-3 text-sm text-[#d8ceb9]">
                                    <p className="authority-data text-[11px] text-[#9e9278]">{entry.timestampSeconds}s</p>
                                    <p className="mt-2">{entry.observation}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="authority-panel rounded-[26px] p-5">
                            <SectionHeader eyebrow="Frame tray" title="Extracted peak frames" />
                            {effectiveSelectedReport.visual?.frames?.length ? (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {effectiveSelectedReport.visual.frames.map((frame) => (
                                  <EvidenceFrameLink key={frame.assetId} frame={frame} />
                                ))}
                              </div>
                            ) : (
                              <div className="mt-4 rounded-[18px] border border-dashed border-[#4d4433] bg-[#17120e] px-4 py-5 text-sm text-[#a59881]">
                                No extracted frame assets are attached to this packet.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="authority-panel rounded-[26px] p-6 text-sm text-[#a89d87]">
                      Select a packet from the queue to inspect its evidence-package sections.
                    </div>
                  )}
                </div>
              )}

              {selectedMainTab === 'trail' && (
                <div className="space-y-5">
                  <SectionHeader
                    eyebrow="Review trail"
                    title={effectiveSelectedReport ? `${effectiveSelectedReport.reference} // operational trail` : 'No packet selected'}
                    helper="Merged processing, integrity, and analyst-review events for the selected packet."
                  />

                  {effectiveSelectedReport ? (
                    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                      <div className="space-y-4">
                        {selectedTrail.length ? (
                          selectedTrail.map((event) => (
                            <TrailEvent key={`${event.kind}-${event.at}-${event.title}`} event={event} />
                          ))
                        ) : (
                          <div className="authority-panel rounded-[26px] px-5 py-6 text-sm text-[#a89d87]">
                            No review trail has been written for this packet yet.
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="authority-panel rounded-[26px] p-5">
                          <SectionHeader eyebrow="Integrity board" title="Signal checks" />
                          <div className="mt-4 space-y-3">
                            {selectedIntegritySignals.map((signal) => (
                              <div key={signal.label} className="flex items-start gap-3 rounded-[18px] border border-[#4d4433] bg-[#17120e] px-4 py-3">
                                {signal.status === 'pass' ? (
                                  <CheckCircle2 size={16} className="mt-0.5 text-[#dce8c3]" />
                                ) : (
                                  <AlertTriangle size={16} className="mt-0.5 text-[#efc4bc]" />
                                )}
                                <div>
                                  <p className="text-sm font-medium text-[#f5ecd7]">{signal.label}</p>
                                  <p className="mt-1 text-sm text-[#b9af99]">{signal.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="authority-panel rounded-[26px] p-5">
                          <SectionHeader eyebrow="Case context" title="Current linked case" />
                          <div className="mt-4 rounded-[20px] border border-[#4d4433] bg-[#17120e] px-4">
                            <MetaRow label="Case ref" value={effectiveSelectedReport.caseView?.reference || 'n/a'} mono />
                            <MetaRow label="Case status" value={humanizeToken(effectiveSelectedReport.caseView?.caseStatus)} />
                            <MetaRow label="Evidence count" value={effectiveSelectedReport.caseView?.evidenceCount ?? 'n/a'} />
                            <MetaRow label="Planning band" value={effectiveSelectedReport.caseView?.planningBand || 'n/a'} />
                            <MetaRow label="Recoverable" value={formatInr(effectiveSelectedReport.caseView?.estimatedRecoverableValueInr || effectiveSelectedReport.estimatedRecoverableValueInr)} />
                            <MetaRow label="Realized" value={formatInr(effectiveSelectedReport.caseView?.realizedValueInr || 0)} />
                            <MetaRow label="Reward eligible" value={effectiveSelectedReport.caseView?.rewardEligible ? 'Yes' : 'No'} />
                          </div>
                        </div>

                        <div className="authority-panel rounded-[26px] p-5">
                          <SectionHeader eyebrow="Contributor context" title="Reporter public view" />
                          {effectiveSelectedReport.contributor ? (
                            <div className="mt-4 rounded-[20px] border border-[#4d4433] bg-[#17120e] px-4">
                              <MetaRow label="Display name" value={effectiveSelectedReport.contributor.displayName || 'n/a'} />
                              <MetaRow label="Trust tier" value={effectiveSelectedReport.contributor.trustTierLabel || effectiveSelectedReport.contributor.trustTier || 'n/a'} />
                              <MetaRow label="Status" value={humanizeToken(effectiveSelectedReport.contributor.status)} />
                              <MetaRow label="City" value={effectiveSelectedReport.contributor.city || 'n/a'} />
                              <MetaRow label="Linked installs" value={effectiveSelectedReport.contributor.linkedInstalls ?? 'n/a'} />
                              <MetaRow label="Current month rewards" value={formatInr(effectiveSelectedReport.contributor.currentMonthRewardsInr || 0)} />
                            </div>
                          ) : (
                            <div className="mt-4 rounded-[18px] border border-dashed border-[#4d4433] bg-[#17120e] px-4 py-5 text-sm text-[#a59881]">
                              No contributor identity is linked to this packet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="authority-panel rounded-[26px] p-6 text-sm text-[#a89d87]">
                      Select a packet from the queue to open its operational trail.
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

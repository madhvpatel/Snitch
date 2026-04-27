import React, { useEffect, useRef, useState } from 'react';

import { GOOGLE_MAPS_API_KEY } from '../../services/config';

const GOOGLE_MAPS_SCRIPT_ID = 'snitch-google-maps-sdk';
const GOOGLE_MAPS_CALLBACK_NAME = '__snitchInitGoogleMaps';
const QUALITY_COLORS = {
  strong: '#d7b667',
  good: '#92a16d',
  review: '#c97f3c',
  weak: '#ad5242',
};

const RETRO_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1e1812' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#c2b497' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#17120d' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#4f4533' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#241c15' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2d241b' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#b4a88d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#4d4333' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2e261d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#dbcaa7' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#372d22' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#24353d' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#96aab2' }] },
];

let googleMapsPromise = null;

const loadGoogleMapsSdk = (apiKey) => {
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is missing. Set VITE_GOOGLE_MAPS_API_KEY.'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    window[GOOGLE_MAPS_CALLBACK_NAME] = () => {
      resolve(window.google.maps);
      delete window[GOOGLE_MAPS_CALLBACK_NAME];
    };

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('error', () => reject(new Error('Google Maps SDK failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Google Maps SDK failed to load.'));
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${GOOGLE_MAPS_CALLBACK_NAME}`;
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

const buildMarkerIcon = (mapsApi, venue, selected, containsSelectedReport) => {
  const fillColor = QUALITY_COLORS[venue.qualityBand] || QUALITY_COLORS.review;

  return {
    path: mapsApi.SymbolPath.CIRCLE,
    fillColor,
    fillOpacity: selected ? 0.96 : containsSelectedReport ? 0.82 : 0.68,
    strokeColor: selected ? '#f5ecd7' : fillColor,
    strokeWeight: selected ? 2.75 : 1.5,
    scale: Math.min(11 + venue.reportCount * 2.25, 23),
  };
};

const formatMapSummary = (venue) => `${venue.venueName} • ${venue.city} • ${venue.reportCount} packet${venue.reportCount === 1 ? '' : 's'}`;

export const AuthorityVenueMap = ({
  venues,
  selectedVenueKey,
  selectedReportId,
  onSelectVenue,
}) => {
  const mapHostRef = useRef(null);
  const mapRef = useRef(null);
  const mapsApiRef = useRef(null);
  const markerEntriesRef = useRef([]);
  const [status, setStatus] = useState(GOOGLE_MAPS_API_KEY ? 'loading' : 'missing_key');
  const [error, setError] = useState('');

  const mappedVenues = venues.filter((venue) => Number.isFinite(venue.lat) && Number.isFinite(venue.lon));

  useEffect(() => {
    if (!mappedVenues.length) {
      return undefined;
    }

    let active = true;

    loadGoogleMapsSdk(GOOGLE_MAPS_API_KEY)
      .then((mapsApi) => {
        if (!active || !mapHostRef.current) {
          return;
        }

        mapsApiRef.current = mapsApi;
        if (!mapRef.current) {
          mapRef.current = new mapsApi.Map(mapHostRef.current, {
            center: { lat: mappedVenues[0].lat, lng: mappedVenues[0].lon },
            zoom: mappedVenues.length === 1 ? 14 : 11,
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
            backgroundColor: '#17120d',
            styles: RETRO_MAP_STYLES,
          });
        }

        setError('');
        setStatus('ready');
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }
        setError(loadError.message || 'Google Maps failed to load.');
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [mappedVenues]);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !mapsApiRef.current) {
      return undefined;
    }

    const mapsApi = mapsApiRef.current;
    const map = mapRef.current;

    markerEntriesRef.current.forEach(({ marker, listener }) => {
      if (listener) {
        mapsApi.event.removeListener(listener);
      }
      marker.setMap(null);
    });
    markerEntriesRef.current = [];

    if (!mappedVenues.length) {
      return undefined;
    }

    const bounds = new mapsApi.LatLngBounds();
    mappedVenues.forEach((venue) => {
      const position = { lat: venue.lat, lng: venue.lon };
      const selected = venue.key === selectedVenueKey;
      const containsSelectedReport = venue.reports.some((report) => report.id === selectedReportId);
      const marker = new mapsApi.Marker({
        map,
        position,
        title: formatMapSummary(venue),
        label: {
          text: String(venue.reportCount),
          color: '#f5ecd7',
          fontSize: '12px',
          fontWeight: '700',
        },
        icon: buildMarkerIcon(mapsApi, venue, selected, containsSelectedReport),
        zIndex: selected ? 200 : containsSelectedReport ? 120 : 80,
      });

      const listener = marker.addListener('click', () => {
        onSelectVenue(venue.key);
      });

      markerEntriesRef.current.push({ marker, listener });
      bounds.extend(position);
    });

    const activeVenue = mappedVenues.find((venue) => venue.key === selectedVenueKey) || null;
    if (activeVenue) {
      map.panTo({ lat: activeVenue.lat, lng: activeVenue.lon });
      map.setZoom(Math.max(map.getZoom() || 11, 14));
    } else if (mappedVenues.length === 1) {
      map.setCenter({ lat: mappedVenues[0].lat, lng: mappedVenues[0].lon });
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, 72);
    }

    return undefined;
  }, [mappedVenues, onSelectVenue, selectedReportId, selectedVenueKey, status]);

  if (!mappedVenues.length) {
    return (
      <div className="authority-panel flex h-[420px] items-center justify-center rounded-[28px] p-6 text-center text-sm text-[#a59881]">
        No mapped venue coordinates are available in the current sweep.
      </div>
    );
  }

  if (status === 'missing_key') {
    return (
      <div className="authority-panel flex h-[420px] flex-col items-center justify-center rounded-[28px] p-6 text-center">
        <p className="authority-label text-[10px] text-[#9f947c]">Google Maps unavailable</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#c9bea8]">
          Set <span className="authority-data">VITE_GOOGLE_MAPS_API_KEY</span> in the frontend env to render live mapped venues.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="authority-panel flex h-[420px] flex-col items-center justify-center rounded-[28px] p-6 text-center">
        <p className="authority-label text-[10px] text-[#9f947c]">Map load failure</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#c9bea8]">
          {error || 'Google Maps could not be loaded for this session.'}
        </p>
      </div>
    );
  }

  return (
    <div className="authority-panel overflow-hidden rounded-[28px]">
      <div className="flex items-center justify-between gap-4 border-b border-[#4c4332] bg-[#18130f]/95 px-5 py-3">
        <div>
          <p className="authority-label text-[10px] text-[#9e9278]">Google Maps Venue Intelligence</p>
          <p className="mt-1 text-sm text-[#cbbfa9]">
            {mappedVenues.length} mapped venue hotzone{mappedVenues.length === 1 ? '' : 's'} in the current sweep.
          </p>
        </div>
        <div className="authority-data text-xs uppercase tracking-[0.16em] text-[#d7b667]">
          Live venue map
        </div>
      </div>
      <div ref={mapHostRef} className="h-[420px] w-full bg-[#17120d]" />
    </div>
  );
};

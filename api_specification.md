# Snitch Backend API Specification

This document provides a detailed API specification for the Snitch backend. It outlines the core endpoints, how the backend services the mobile application, the data it captures from the device, and how it utilizes third-party integrations like ACRCloud, Google Maps, and Gemini to validate and process submissions.

---

## 1. System Architecture Overview

The backend comprises two main services:
- **Node.js Main Server (`server/index.js`)**: The primary API gateway handling authentication, mobile application requests, media parsing, orchestration of validation workflows, and database (JSON store) management.
- **Python AI Media Server (`python-backend/app.py`)**: A supplementary microservice handling proxying and specific ML/AI media separation tasks (e.g., vocal isolation).

---

## 2. Servicing the Mobile Application

The Node.js server extensively supports the mobile application by providing a structured flow from installation to secure media capture and submission. 

### A. Authentication & Onboarding
- **`POST /api/mobile/auth/signup`** & **`POST /api/mobile/auth/login`**: Manages secure access for mobile users.
- **`POST /api/mobile/capture/install`**: Registers a unique installation of the app on a specific device using public keys to prevent spoofing and link device tokens to authenticated users.
- **`GET /api/user/profile`**, **`GET /api/user/rewards`**, **`GET /api/user/submissions`**: Profile retrieval and submission status checks.

### B. The Capture Flow (Media Submission)
The core feature of the mobile application is securely capturing and uploading video/audio evidence with high integrity.

1. **Clock Synchronization**
   - **`GET/POST /api/mobile/capture/time`**: Synchronizes the client's clock with the server to calculate exact timing offsets and prevent manipulation of submission times.
2. **Session Initialization**
   - **`POST /api/mobile/capture/session`**: Generates a secure token/nonce for a new recording session.
   - **`POST /api/mobile/capture/session/:id/start`**: Acknowledges that the recording has started and securely logs the start time and geolocation.
3. **Evidence Submission Initialization**
   - **`POST /api/mobile/capture/submissions`**: Validates the session and initializes a database record for the new media submission. Here, device-level metadata is submitted (see Section 3).
4. **Media Upload & Finalization**
   - **`POST /api/mobile/capture/submissions/:id/upload`**: Securely uploads the large binary payload (e.g., `video/mp4` or `video/webm`).
   - **`POST /api/mobile/capture/submissions/:id/finalize`**: Locks the submission and triggers asynchronous processing/validation workers.
   - **`GET /api/mobile/capture/submissions/:id/status`**: Allows the mobile app to poll the status of their submitted evidence.

---

## 3. What the System Captures From the Device

To ensure the validity and forensic integrity of every capture, the API extracts detailed metadata from the mobile app alongside the media file:

### Geolocation & Timing Data
- **Location Coordinates**: Start and end Latitude/Longitude (`start_lat`, `start_lng`, `end_lat`, `end_lng`).
- **Accuracy Metrics**: GPS accuracy radius for both start and end locations (`start_accuracy`, `end_accuracy`).
- **Temporal Context**: Exact local timestamps (`local_start_time`, `local_end_time`) and calculated offsets vs. the server clock (`server_offset_start_ms`, `server_offset_end_ms`) to detect clock tampering.

### Device & Application Integrity
- **Device Specifications**: Device model (`device_model`), OS version (`os_version`).
- **App Version**: The exact mobile app version used (`app_version`).
- **Media Integrity**: SHA-256 secure hash of the uploaded media (`media_hash`) generated natively on the device to prevent man-in-the-middle manipulation.
- **MIME Type & Filename**: Details describing the payload (`mime_type`, `file_name`, `file_size`).

### Contextual Metadata
- **Venue/Business Details**: The specifically selected real-world venue metadata (`selected_venue_name`, `selected_venue_provider`, `selected_venue_latitude` etc.) or manual fallbacks via `business_name` and `gstin`.
- **Radio Evidence**: Extracted insights related to what media was playing based on user/system selection.

---

## 4. Third-Party Integrations

### ACRCloud
**Purpose**: Audio Fingerprinting and Song Identification.
- **Endpoints Used**: Internal validation and `POST /api/identify`
- **What it captures**: The backend extracts the audio stream from the uploaded video payload and queries ACRCloud. It captures the song **Title**, **Artists**, **Album**, **Match Score**, and the exact **Play Offset (in milliseconds)** to mathematically confirm what specific audio frame is playing in the recorded environment.

### Google Maps (and Foursquare)
**Purpose**: Proximity checks and Venue matching.
- **Endpoints Used**: `GET /api/nearby-venues`
- **What it captures**: Taking the user's current Latitude, Longitude (`ll`), and GPS accuracy (`hacc`), it fetches verified Points of Interest (POI). It captures and securely links standard fields such as the **Place Name**, **Address**, **City**, precise **Lat/Lng**, and a unique `placeProviderId` (usually `google_maps`), allowing the user to precisely document the location where the media was recorded.

### Google Gemini
**Purpose**: Visual Verification, Forensic Analysis, and Fraud Detection.
- **Endpoints Used**: Internal processing during session finalization workflows.
- **How and Where it is Used**:
  1. **Visual Analysis (`visualAnalysis`)**: The backend extracts visual frames from the video. Gemini parses these frames, looking for spatial contexts (e.g., checking if it looks like a legitimate retail store or dining environment).
  2. **Forensic Summary (`forensicSummary`)**: Gemini synthesizes the audio and visual queues to detect inconsistencies.
  3. **Application Assessment (`generateApplicationAssessment`)**: Gemini serves as a macro-validation tool ("rescoring"). It combines all data—the ACRCloud matches, Google Maps venue data, and geographic information—into a localized context. It evaluates if the recording aligns with the physical claims (i.e. did the user actually record at the given venue with the claimed radio setup?) and generates an assessment to catch fraudulent manual claims.

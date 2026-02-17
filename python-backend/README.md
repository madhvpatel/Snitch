# Python ACRCloud Backend

Flask-based backend using the official ACRCloud Python SDK.

## Setup

```bash
cd python-backend
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Server will start on http://localhost:3001

## Endpoints

- `GET /health` - Health check
- `POST /api/identify` - Audio fingerprint recognition (ACRCloud)
- `POST /api/identify-lyrics` - Lyrics-based search (fallback)

## Environment

See `.env` file for ACRCloud credentials.

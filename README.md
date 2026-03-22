# miruns-link

> **⚠️ Early Development** — This project is under active development and is **not production-ready**. APIs, schemas, and behaviour may change without notice.

Ephemeral session sharing API. Devices create sessions identified by short unique codes. Anyone with the code can read the data; only the originating device can update or delete it.

## Quick start

```bash
cp .env.example .env        # edit MONGODB_URI + S3 credentials
npm install
npm run dev                  # starts with hot-reload via tsx
```

## Architecture

```
Flutter app  ──▶  miruns-link API  ──▶  MongoDB   (metadata: code, deviceId, dataSize, TTL)
                                   ──▶  S3        (payload: sessions/<code>.json)
```

- **MongoDB** stores lightweight metadata (~200 bytes per session).
- **S3** stores the full session payload (can be several MB of time-series data).
- S3-compatible: works with AWS S3, MinIO, DigitalOcean Spaces, Cloudflare R2, etc.

## Endpoints

| Method   | Path                  | Auth          | Description                  |
| -------- | --------------------- | ------------- | ---------------------------- |
| `GET`    | `/health`             | —             | Health check                 |
| `POST`   | `/sessions`           | `X-Device-Id` | Create a new session         |
| `GET`    | `/sessions/:code`     | —             | Retrieve session by code     |
| `PATCH`  | `/sessions/:code`     | `X-Device-Id` | Update session (owner only)  |
| `DELETE` | `/sessions/:code`     | `X-Device-Id` | Delete session (owner only)  |
| `GET`    | `/sessions/device/me` | `X-Device-Id` | List all sessions for device |

### Headers

- `X-Device-Id` — unique device identifier (required for write ops & listing)

### POST /sessions

```json
// Request
{
  "data": { "workoutType": "running", "hrSamples": [...] },
  "ttlHours": 48
}

// Response 201
{
  "code": "a3Xk9m2p",
  "expiresAt": "2026-03-25T12:00:00.000Z",
  "createdAt": "2026-03-22T12:00:00.000Z"
}
```

### PATCH /sessions/:code

```json
// Request — merges into existing data
{
  "data": { "feedback": { "fatigueLevel": 7 } }
}

// Response 200
{
  "code": "a3Xk9m2p",
  "data": { ... },
  "updatedAt": "...",
  "expiresAt": "..."
}
```

## Design

- **No auth**: ownership is tied to `X-Device-Id`.
- **TTL**: sessions auto-expire (default 72h) via MongoDB TTL index. Set an S3 lifecycle rule to clean up orphaned objects.
- **Flexible payload**: `data` is a schemaless JSON blob — the Flutter app decides the shape.
- **Scalable storage**: MongoDB stays small; S3 handles multi-MB payloads.
- **Rate limited**: 200 requests / 15 min per IP.

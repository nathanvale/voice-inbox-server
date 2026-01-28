# Voice Inbox Server

HTTP server that accepts voice transcriptions from iOS Shortcuts and returns formatted Obsidian note content. Designed to work with SuperWhisper and Obsidian's Advanced URI plugin.

## Why?

- **URL length limits** (~2000-8000 chars) prevent using Obsidian Advanced URI for long transcriptions
- **Obsidian Sync** means iOS Shortcuts can't write directly to the vault filesystem
- **Solution:** POST to this server → get formatted note → copy to clipboard → open Advanced URI with `clipboard=true`

## Endpoints

### `GET /`

Health check.

```json
{
  "status": "ok",
  "service": "voice-inbox-server",
  "timestamp": "2026-01-28T05:30:00.000Z"
}
```

### `POST /convert`

Convert transcription text to Obsidian note format.

**Request:**

```json
{
  "text": "Your transcription text here...",
  "source": "superwhisper"
}
```

- `text` (required): The transcription content
- `source` (optional): Source identifier, defaults to "superwhisper"

**Response:**

```json
{
  "success": true,
  "noteContent": "---\ntype: transcription\ncreated: 2026-01-28\nsource: superwhisper\ntemplate_version: 1\nareas: []\nprojects: []\nsummary: \"\"\n---\n\nYour transcription text here...\n",
  "filename": "🎤 2026-01-28 2-51pm"
}
```

## Local Development

```bash
# Install dependencies
bun install

# Start development server (with hot reload)
bun dev

# Run tests
bun test

# Start production server
bun start
```

Test locally:

```bash
curl http://localhost:3000/

curl -X POST http://localhost:3000/convert \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a test transcription from SuperWhisper."}'
```

## Deploy to Railway

1. **Push to GitHub** (done via template setup)

2. **Connect Railway:**
   - Go to [railway.app](https://railway.app) → New Project
   - Select "Deploy from GitHub repo"
   - Select `nathanvale/voice-inbox-server`

3. **Railway auto-detects Bun** and runs `bun start`

4. **Generate domain:**
   - Settings → Networking → Generate Domain
   - Note URL: `https://voice-inbox-server-production.up.railway.app`

Every push to `main` triggers automatic redeploy.

## iOS Shortcut Setup

Create a shortcut with these steps:

### Step 1: Get Transcription

1. **Get Clipboard** - Gets the transcription from SuperWhisper

### Step 2: POST to Server

2. **Get Contents of URL**
   - URL: `https://your-server.railway.app/convert`
   - Method: POST
   - Headers: `Content-Type: application/json`
   - Request Body: JSON
     - `text`: Clipboard
     - `source`: `superwhisper`

### Step 3: Copy Note Content

3. **Get Dictionary Value** - Key: `noteContent`
4. **Copy to Clipboard** - Copy the note content

### Step 4: Get Filename

5. **Get Dictionary Value** (from step 2 result) - Key: `filename`
6. **URL Encode** - Encode the filename

### Step 5: Open Obsidian

7. **Text** - Build URI:
   ```
   obsidian://adv-uri?vault=my-second-brain&filepath=00%20Inbox/[URL Encoded filename].md&clipboard=true&mode=new
   ```
8. **Open URLs** - Open the text from step 7

### Result

Creates `00 Inbox/🎤 2026-01-28 2-51pm.md` with:

```markdown
---
type: transcription
created: 2026-01-28
source: superwhisper
template_version: 1
areas: []
projects: []
summary: ""
---

Your transcription text here...
```

## Future: Migration to Mac Mini

When you have an always-on Mac Mini:

1. Run server locally: `bun start`
2. Expose via Tailscale or Cloudflare Tunnel
3. Update shortcut URL to Tailscale address
4. Cancel Railway subscription

## Configuration

| Env Variable | Default | Description |
|--------------|---------|-------------|
| `PORT` | `3000` | Server port |

## License

MIT

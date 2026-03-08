# ProofSnap HTTP Trigger Server

This server enables external scripts to trigger ProofSnap screenshot captures via HTTP, without requiring browser window focus.

## Features

- **HTTP API**: `http://localhost:19999` for capture requests
- **WebSocket**: `ws://localhost:19998` for extension communication  
- **No Focus Required**: Screenshots are captured without stealing window focus
- **No Installation Required**: Just run the Python script
- **Automation Friendly**: Works with cron jobs, scripts, bots, etc.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Health check - returns connection status |
| `POST` | `/capture` | Capture visible tab screenshot |
| `POST` | `/capture/selection` | Start selection mode capture |

## Setup

### Prerequisites

- Python 3.x installed
- ProofSnap extension installed and running in Chrome

### Step 1: Install websockets package (one time)

```bash
pip install websockets
```

### Step 2: Run the server

```bash
python proofsnap_host.py
```

You should see:
```
==================================================
ProofSnap Trigger Server
==================================================
HTTP  endpoint: http://127.0.0.1:19999
WebSocket port: ws://127.0.0.1:19998

Endpoints:
  GET  /status  - Health check
  POST /capture - Trigger screenshot

Waiting for ProofSnap extension to connect...
==================================================
```

### Step 3: The extension auto-connects

When the server is running and you have ProofSnap extension loaded:
- The extension automatically connects via WebSocket
- You'll see: `[WS] Extension connected`

## Usage Examples

### PowerShell
```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:19999/status"

# Capture screenshot
Invoke-RestMethod -Uri "http://localhost:19999/capture" -Method POST
```

### curl
```bash
# Health check
curl http://localhost:19999/status

# Capture screenshot
curl -X POST http://localhost:19999/capture
```

### Python
```python
import requests

# Check status
status = requests.get('http://localhost:19999/status').json()
print(f"Connected clients: {status['connected_clients']}")

# Capture screenshot
response = requests.post('http://localhost:19999/capture')
print(response.json())
```

## Troubleshooting

### "No extension connected"

The extension hasn't connected to the WebSocket server yet.

1. Make sure Chrome is running with ProofSnap extension enabled
2. Check the extension's service worker console for connection messages
3. Try reloading the extension

### Screenshots not being captured

1. Make sure there's an active browser tab
2. Check the extension's service worker console for errors
3. Verify you're logged in to ProofSnap if auto-upload is enabled

## How it Works

```
┌─────────────┐    HTTP POST /capture    ┌──────────────────┐
│ Your Script │ ───────────────────────> │  Python Server   │
│ (curl/etc)  │ <─────────────────────── │  (port 19999)    │
└─────────────┘    JSON response         └────────┬─────────┘
                                                  │ WebSocket
                                                  │ (port 19998)
                                                  ▼
                                         ┌──────────────────┐
                                         │ ProofSnap Ext    │
                                         │ (Chrome)         │
                                         └──────────────────┘
```

1. Python server listens on HTTP (19999) and WebSocket (19998)
2. Extension connects to WebSocket on startup
3. Your script POSTs to HTTP endpoint
4. Server sends capture command via WebSocket
5. Extension captures screenshot

## Security

- HTTP server only accepts connections from `localhost` (127.0.0.1)
- WebSocket is also localhost-only
- No external network access

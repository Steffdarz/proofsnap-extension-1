#!/bin/bash
#
# Install ProofSnap Native Messaging Host for Linux/macOS
#
# Usage:
#   ./install.sh <extension-id>
#
# The extension ID can be found at chrome://extensions/ (enable Developer mode)
#

set -e

HOST_NAME="com.numbersprotocol.proofsnap"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/proofsnap_host.py"

echo "ProofSnap Native Host Installer"
echo "================================"
echo ""

# Check for extension ID argument
if [ -z "$1" ]; then
    echo "Usage: $0 <extension-id>"
    echo ""
    echo "Find your extension ID at chrome://extensions/ (enable Developer mode)"
    exit 1
fi

EXTENSION_ID="$1"

# Validate extension ID format (32 lowercase letters)
if ! echo "$EXTENSION_ID" | grep -qE '^[a-z]{32}$'; then
    echo "✗ Invalid extension ID format. Should be 32 lowercase letters."
    echo "  Find it at chrome://extensions/ (enable Developer mode)"
    exit 1
fi

echo "Extension ID: $EXTENSION_ID"

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "✗ Python not found. Please install Python 3.x first."
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version)
echo "✓ Python found: $PYTHON_VERSION"

# Make host script executable
chmod +x "$HOST_SCRIPT"
echo "✓ Made host script executable"

# Determine manifest directory based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    MANIFEST_DIR_EDGE="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
else
    # Linux
    MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    MANIFEST_DIR_EDGE="$HOME/.config/microsoft-edge/NativeMessagingHosts"
fi

# Create manifest directory
mkdir -p "$MANIFEST_DIR"
echo "✓ Created directory: $MANIFEST_DIR"

# Create the manifest file
MANIFEST_FILE="$MANIFEST_DIR/$HOST_NAME.json"
cat > "$MANIFEST_FILE" << EOF
{
  "name": "$HOST_NAME",
  "description": "ProofSnap Native Messaging Host - HTTP trigger for screenshot capture",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✓ Created manifest: $MANIFEST_FILE"

# Also install for Edge if directory exists or can be created
if [[ -d "$(dirname "$MANIFEST_DIR_EDGE")" ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    mkdir -p "$MANIFEST_DIR_EDGE"
    cp "$MANIFEST_FILE" "$MANIFEST_DIR_EDGE/"
    echo "✓ Also registered with Edge"
fi

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Reload the ProofSnap extension in Chrome"
echo "2. Test with: curl -X POST http://localhost:19999/capture"
echo ""
echo "The HTTP server will start automatically when the extension connects."

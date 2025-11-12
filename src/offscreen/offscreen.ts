/**
 * Offscreen Document for Canvas Operations
 * Used for adding watermarks to screenshots
 */

console.log('ProofSnap offscreen document loaded');

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ADD_WATERMARK') {
    addWatermark(message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

/**
 * Add watermark to screenshot
 * - Logo is always added in bottom-right
 * - Timestamp is optional based on user settings
 */
async function addWatermark(payload: {
  dataUrl: string;
  timestamp: string;
  width: number;
  height: number;
  timestampSize?: 'small' | 'medium' | 'large';
  includeTimestamp?: boolean;
}): Promise<{ dataUrl: string }> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Load and draw original image
  const img = await loadImage(payload.dataUrl);
  canvas.width = payload.width;
  canvas.height = payload.height;
  ctx.drawImage(img, 0, 0);

  // Add timestamp if enabled
  if (payload.includeTimestamp !== false) {
    drawTimestamp(ctx, payload.timestamp, payload.timestampSize);
  }

  // Always draw logo
  await drawLogo(ctx, canvas.width, canvas.height);

  // Convert to data URL
  return { dataUrl: canvas.toDataURL('image/png') };
}

/**
 * Draw timestamp watermark in top-left
 */
function drawTimestamp(
  ctx: CanvasRenderingContext2D,
  timestampStr: string,
  size: 'small' | 'medium' | 'large' = 'medium'
): void {
  const timestamp = new Date(timestampStr);
  const timeText = formatTime(timestamp);
  const dateText = formatDate(timestamp);

  // Calculate responsive sizing
  const sizeMultipliers = { small: 1.5, medium: 2, large: 2.5 };
  const sizeMultiplier = sizeMultipliers[size];
  const baseFontSize = Math.max(20, Math.floor(ctx.canvas.height / 35));
  const timeFontSize = baseFontSize * sizeMultiplier;
  const dateFontSize = baseFontSize * (sizeMultiplier / 2);

  // Measure text
  ctx.font = `700 ${timeFontSize}px system-ui, -apple-system, sans-serif`;
  const timeWidth = ctx.measureText(timeText).width;
  ctx.font = `400 ${dateFontSize}px system-ui, -apple-system, sans-serif`;
  const dateWidth = ctx.measureText(dateText).width;

  // Calculate box dimensions
  const padding = 16;
  const boxWidth = Math.max(timeWidth, dateWidth) + padding * 2;
  const boxHeight = timeFontSize + dateFontSize + padding * 2 + 8;
  const position = { x: 20, y: 60 };

  // Draw background box with shadow
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(position.x, position.y, boxWidth, boxHeight, 8);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Draw text
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.font = `700 ${timeFontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(timeText, position.x + padding, position.y + padding);

  ctx.fillStyle = 'rgba(26, 26, 26, 0.9)';
  ctx.font = `400 ${dateFontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(dateText, position.x + padding, position.y + padding + timeFontSize + 4);
}

/**
 * Draw ProofSnap logo in bottom-right corner
 */
async function drawLogo(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  try {
    const logo = await loadImage('../../images/Word-Logo-Bright-crop.png');
    const logoWidth = Math.max(100, Math.floor(canvasWidth / 12));
    const logoHeight = logoWidth * (157 / 828); // Exact aspect ratio from source (828x157)
    const logoX = canvasWidth - logoWidth - 20;
    const logoY = canvasHeight - logoHeight - 20;

    ctx.globalAlpha = 0.7;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
    ctx.globalAlpha = 1.0;
  } catch (error) {
    console.warn('Failed to load logo:', error);
  }
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Format time (HH:MM)
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format date (DD/MM/YYYY Day)
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  
  return `${day}/${month}/${year} ${weekday}`;
}

export {};

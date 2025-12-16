/**
 * Popup React Application
 * Main UI for the ProofSnap extension
 */

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { indexedDBService, type Asset } from '../services/IndexedDBService';
import { storageService } from '../services/StorageService';
import AuthForm from './AuthForm';
import InsufficientCreditsNotification from './InsufficientCreditsNotification';
import { getNumbersApi } from '../services/NumbersApiManager';
import './popup.css';

/**
 * Main Popup Component
 */
function PopupApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [showInsufficientCreditsNotification, setShowInsufficientCreditsNotification] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setIsLoading(true);
    try {
      const numbersApi = await getNumbersApi();
      const authenticated = numbersApi.auth.isAuthenticated();
      setIsAuthenticated(authenticated);

      // Get username and email for dashboard link and UI
      if (authenticated) {
        const auth = await storageService.getAuth();
        if (auth?.username) {
          setUsername(auth.username);
        }
        if (auth?.email) {
          setEmail(auth.email);
        }
      }

      // Get assets from IndexedDB (upload queue: drafts, uploading, failed)
      // Successfully uploaded assets are deleted to save disk space
      const assets = await indexedDBService.getAllAssets();
      setAssets(assets);

      // Check for insufficient credits error
      await checkCreditStatus(assets);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCapture() {
    setCapturing(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        payload: {
          mode: 'visible',
        },
      });

      if (response.success) {
        console.log('Screenshot captured:', response.data);
        // Reload assets from IndexedDB
        const assets = await indexedDBService.getAllAssets();
        setAssets(assets);
      } else {
        console.error('Capture failed:', response.error);
        alert('Failed to capture screenshot: ' + response.error);
      }
    } catch (error) {
      console.error('Capture error:', error);
      alert('Failed to capture screenshot');
    } finally {
      setCapturing(false);
    }
  }

  async function handleUpload(assetId: string) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPLOAD_ASSET',
        payload: { assetId },
      });

      if (response.success) {
        console.log('Asset queued for upload');
        // No need to reload - UPLOAD_PROGRESS listener will handle it
      } else {
        alert('Failed to queue upload: ' + response.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload asset');
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  function openDashboard() {
    if (username) {
      chrome.tabs.create({
        url: `https://dashboard.captureapp.xyz/showcase/${username}`,
      });
    }
  }

  async function checkCreditStatus(currentAssets: Asset[]) {
    // Check if any asset failed due to insufficient credits
    const hasCreditError = currentAssets.some(
      asset => asset.status === 'failed' && asset.metadata?.errorType === 'insufficient_credits'
    );

    // Early exit if notification is already showing - avoid redundant storage queries
    if (showInsufficientCreditsNotification) {
      return;
    }

    if (hasCreditError) {
      // Only query storage if we're considering showing the notification
      const dismissed = await storageService.hasInsufficientCreditsNotificationDismissed();
      if (!dismissed) {
        setShowInsufficientCreditsNotification(true);
      }
    }
  }

  async function handleCloseNotification() {
    setShowInsufficientCreditsNotification(false);
    // Mark as dismissed so we don't show it again until they successfully upload
    await storageService.setInsufficientCreditsNotificationDismissed(true);
  }

  async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      const numbersApi = await getNumbersApi();
      await numbersApi.clearAuth();
      setIsAuthenticated(false);
      setUsername('');
      // Force reload to switch to login view
      window.location.reload();
    }
  }

  // Listen for upload progress updates
  useEffect(() => {
    const handleMessage = async (message: any) => {
      if (message.type === 'UPLOAD_PROGRESS') {
        // Reload assets to show updated progress
        const assets = await indexedDBService.getAllAssets();
        setAssets(assets);
        await checkCreditStatus(assets);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [showInsufficientCreditsNotification]); // Add dependency since checkCreditStatus uses this state

  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="popup-container">
        <div className="header">
          <h1>ProofSnap</h1>
          <p>Snap once. Prove forever.</p>
        </div>
        <div className="content">
          <AuthForm onLogin={() => {
            // After login, reload initial data
            loadInitialData();
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <PopupHeader
        username={username}
        email={email}
        onLogout={handleLogout}
        onOpenOptions={openOptions}
      />

      {showInsufficientCreditsNotification && (
        <InsufficientCreditsNotification
          onClose={handleCloseNotification}
        />
      )}

      <CaptureSection
        capturing={capturing}
        onCapture={handleCapture}
      />

      <AssetList
        assets={assets}
        onUpload={handleUpload}
      />

      <PopupFooter onOpenDashboard={openDashboard} />
    </div>
  );
}

/**
 * Popup Header Component
 */
function PopupHeader({
  username,
  email,
  onLogout,
  onOpenOptions
}: {
  username: string;
  email: string;
  onLogout: () => void;
  onOpenOptions: () => void;
}) {
  return (
    <div className="header">
      <h1>ProofSnap</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Account Details */}
        <div className="account-details">
          <span className="account-username">{username || 'User'}</span>
          {email && <span className="account-email" title={email}>{email}</span>}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="icon-button logout-button"
            onClick={onLogout}
            title="Logout"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
          <button
            className="icon-button"
            onClick={onOpenOptions}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Capture Section Component
 */
function CaptureSection({
  capturing,
  onCapture
}: {
  capturing: boolean;
  onCapture: () => void;
}) {
  return (
    <div className="capture-section">
      <button
        className="capture-button"
        onClick={onCapture}
        disabled={capturing}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {capturing ? (
            <>
              <span className="spinner-small" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
              Snapping...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Snap
            </>
          )}
        </div>
      </button>
    </div>
  );
}

/**
 * Asset List Component
 */
function AssetList({
  assets,
  onUpload
}: {
  assets: Asset[];
  onUpload: (id: string) => void;
}) {
  return (
    <div className="content">
      <div className="section-header">
        <h2>Asset Status</h2>
        <span className="count">{assets.length}</span>
      </div>

      {assets.length === 0 ? (
        <div className="empty-state">
          <p>Nothing in progress</p>
          <p className="hint">Assets appear here when captured. Successful uploads are automatically removed (view them on your dashboard). Failed ones stay visible - click to retry.</p>
        </div>
      ) : (
        <div className="asset-grid">
          {assets.slice(0, 6).map((asset) => (
            <AssetThumbnail key={asset.id} asset={asset} onUpload={onUpload} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Footer Component
 */
function PopupFooter({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  return (
    <div className="footer">
      <button className="link-button" onClick={onOpenDashboard}>
        View on Dashboard →
      </button>
    </div>
  );
}

/**
 * Asset Thumbnail Component
 */
function AssetThumbnail({ asset, onUpload }: { asset: Asset; onUpload?: (assetId: string) => void }) {
  const date = new Date(asset.createdAt);
  const statusColors: Record<string, string> = {
    draft: '#808080',
    uploading: '#FFA500',
    uploaded: '#21B76E',
    failed: '#FF5560',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    draft: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
    uploading: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
    ),
    uploaded: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    ),
    failed: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    ),
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpload && (asset.status === 'draft' || asset.status === 'failed')) {
      onUpload(asset.id);
    }
  };

  const handleViewOnBlockchain = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (asset.metadata?.nid) {
      // Open Numbers Protocol asset page in new tab
      chrome.tabs.create({
        url: `https://verify.numbersprotocol.io/asset-profile/${asset.metadata.nid}`,
      });
    }
  };

  return (
    <div className="asset-thumbnail">
      <img src={asset.uri} alt="Screenshot" />
      <div className="asset-info">
        <div className="asset-meta">
          <div className="asset-date">{date.toLocaleDateString()}</div>
          {asset.sourceWebsite && (() => {
            try {
              const hostname = new URL(asset.sourceWebsite.url).hostname;
              return (
                <div className="asset-website" title={asset.sourceWebsite.url} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  {hostname}
                </div>
              );
            } catch {
              return null;
            }
          })()}
        </div>
        {asset.status === 'uploaded' && asset.metadata?.nid ? (
          <div
            className="asset-status blockchain-link"
            style={{ backgroundColor: statusColors[asset.status], display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={handleViewOnBlockchain}
            title="View on blockchain"
          >
            {statusIcons[asset.status]} Verified
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </div>
        ) : (
          <div
            className="asset-status"
            style={{ backgroundColor: statusColors[asset.status] || '#808080', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={handleUploadClick}
            title={
              asset.status === 'draft' ? 'Click to upload' :
                asset.status === 'failed' ?
                  (asset.metadata?.errorType === 'insufficient_credits' ?
                    'Upload failed: Insufficient credits. Click to retry.' :
                    'Click to retry upload') :
                  asset.status
            }
          >
            {statusIcons[asset.status] || ''} {
              asset.status === 'failed' && asset.metadata?.errorType === 'insufficient_credits'
                ? 'No credits'
                : asset.status
            }
          </div>
        )}
      </div>
      {asset.status === 'uploading' && asset.metadata?.uploadProgress && (
        <div className="upload-progress">
          <div
            className="upload-progress-bar"
            style={{ width: `${(asset.metadata.uploadProgress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Mount React app
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<PopupApp />);
}

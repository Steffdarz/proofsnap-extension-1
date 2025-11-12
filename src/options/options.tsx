/**
 * Options/Settings Page
 * Full-featured settings and authentication page
 */

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { storageService, StoredSettings } from '../services/StorageService';
import { getNumbersApi } from '../services/NumbersApiManager';
import './options.css';

/**
 * Account Section Component
 */
function AccountSection({
  isAuthenticated,
  userInfo,
  onLogout,
}: {
  isAuthenticated: boolean;
  userInfo: { email: string; username: string } | null;
  onLogout: () => void;
}) {
  return (
    <section className="settings-section">
      <h2>👤 Account</h2>
      {isAuthenticated && userInfo ? (
        <div className="account-info">
          <div className="info-row">
            <span className="label">Email:</span>
            <span className="value">{userInfo.email}</span>
          </div>
          <div className="info-row">
            <span className="label">Username:</span>
            <span className="value">{userInfo.username}</span>
          </div>
          <button className="button-secondary" onClick={onLogout}>
            Logout
          </button>
        </div>
      ) : (
        <div className="auth-message">
          <p>Not logged in</p>
          <button className="button-primary" onClick={() => chrome.runtime.openOptionsPage()}>
            Login
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Watermark Settings Component
 */
function WatermarkSettings({
  settings,
  onSave,
}: {
  settings: StoredSettings;
  onSave: (updates: Partial<StoredSettings>) => void;
}) {
  return (
    <section className="settings-section">
      <h2>🕐 Timestamp Watermark</h2>

      <div className="setting-item">
        <div className="setting-header">
          <label htmlFor="includeTimestamp">Show timestamp on snaps</label>
          <input
            id="includeTimestamp"
            type="checkbox"
            checked={settings.includeTimestamp}
            onChange={(e) => onSave({ includeTimestamp: e.target.checked })}
            className="toggle-switch"
          />
        </div>
        <p className="setting-description">
          Add a timestamp watermark to your snaps
        </p>
      </div>

      <div className="setting-item">
        <label htmlFor="timestampSize">Timestamp size</label>
        <select
          id="timestampSize"
          value={settings.timestampSize}
          onChange={(e) => onSave({ timestampSize: e.target.value as 'small' | 'medium' | 'large' })}
          disabled={!settings.includeTimestamp}
          className="select-input"
        >
          <option value="small">Small</option>
          <option value="medium">Medium (Default)</option>
          <option value="large">Large</option>
        </select>
        <p className="setting-description">
          Adjust the size of the timestamp watermark
        </p>
      </div>
    </section>
  );
}

/**
 * Website Info Settings Component
 */
function WebsiteInfoSettings({
  settings,
  onSave,
}: {
  settings: StoredSettings;
  onSave: (updates: Partial<StoredSettings>) => void;
}) {
  return (
    <section className="settings-section">
      <h2>🌐 Website Information</h2>

      <div className="setting-item">
        <div className="setting-header">
          <label htmlFor="includeWebsiteInfo">Include website source</label>
          <input
            id="includeWebsiteInfo"
            type="checkbox"
            checked={settings.includeWebsiteInfo}
            onChange={(e) => onSave({ includeWebsiteInfo: e.target.checked })}
            className="toggle-switch"
          />
        </div>
        <p className="setting-description">
          Capture and store the URL, page title, and domain of the website where the snap was taken.
          This information will be included in the blockchain metadata for verification.
        </p>
      </div>
    </section>
  );
}

/**
 * Capture Settings Component
 */
function CaptureSettings({
  settings,
  onSave,
}: {
  settings: StoredSettings;
  onSave: (updates: Partial<StoredSettings>) => void;
}) {
  return (
    <section className="settings-section">
      <h2>📸 Capture Settings</h2>

      {/* TODO: Implement capture mode selection in future
      <div className="setting-item">
        <label htmlFor="defaultCaptureMode">Default capture mode</label>
        <select
          id="defaultCaptureMode"
          value={settings.defaultCaptureMode}
          onChange={(e) => onSave({ defaultCaptureMode: e.target.value as any })}
          className="select-input"
        >
          <option value="visible">Visible Tab (Current View)</option>
          <option value="selection">Selection Area</option>
          <option value="fullpage">Full Page</option>
        </select>
        <p className="setting-description">
          Choose how snaps are captured by default
        </p>
      </div>
      */}

      <div className="setting-item">
        <label htmlFor="screenshotFormat">Image format</label>
        <select
          id="screenshotFormat"
          value={settings.screenshotFormat}
          onChange={(e) => onSave({ screenshotFormat: e.target.value as 'png' | 'jpeg' })}
          className="select-input"
        >
          <option value="png">PNG (Lossless)</option>
          <option value="jpeg">JPEG (Compressed)</option>
        </select>
        <p className="setting-description">
          PNG preserves quality, JPEG creates smaller files
        </p>
      </div>

      {settings.screenshotFormat === 'jpeg' && (
        <div className="setting-item">
          <label htmlFor="screenshotQuality">
            JPEG Quality: {settings.screenshotQuality}%
          </label>
          <input
            id="screenshotQuality"
            type="range"
            min="50"
            max="100"
            value={settings.screenshotQuality}
            onChange={(e) => onSave({ screenshotQuality: parseInt(e.target.value) })}
            className="range-input"
          />
          <p className="setting-description">
            Higher quality = larger file size
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Upload Settings Component
 */
function UploadSettings({
  settings,
  onSave,
}: {
  settings: StoredSettings;
  onSave: (updates: Partial<StoredSettings>) => void;
}) {
  return (
    <section className="settings-section">
      <h2>☁️ Upload Settings</h2>

      <div className="setting-item">
        <div className="setting-header">
          <label htmlFor="autoUpload">Auto-upload after capture</label>
          <input
            id="autoUpload"
            type="checkbox"
            checked={settings.autoUpload}
            onChange={(e) => onSave({ autoUpload: e.target.checked })}
            className="toggle-switch"
          />
        </div>
        <p className="setting-description">
          Automatically upload and create cryptographic proof after capture
        </p>
      </div>
    </section>
  );
}

/**
 * Main Options App Component
 */
function OptionsApp() {
  const [settings, setSettings] = useState<StoredSettings | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [storedSettings, user] = await Promise.all([
        storageService.getSettings(),
        storageService.getAuth(),
      ]);
      const numbersApi = await getNumbersApi();
      const authenticated = numbersApi.auth.isAuthenticated();
      setSettings(storedSettings);
      setIsAuthenticated(authenticated);
      setUserInfo(user);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(updates: Partial<StoredSettings>) {
    if (!settings) return;

    try {
      const newSettings = { ...settings, ...updates };
      await storageService.setSettings(newSettings);
      setSettings(newSettings);

      // Show success message briefly
      const savedMessage = document.querySelector('.saved-message');
      if (savedMessage) {
        savedMessage.classList.add('show');
        setTimeout(() => savedMessage.classList.remove('show'), 2000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  }

  async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      const numbersApi = await getNumbersApi();
      await numbersApi.clearAuth();
      setIsAuthenticated(false);
      setUserInfo(null);
    }
  }

  if (loading) {
    return (
      <div className="options-container">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="options-container">
        <div className="error">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="options-container">
      <header className="options-header">
        <div className="header-content">
          <h1>⚙️ ProofSnap Settings</h1>
          <p className="subtitle">Snap once. Prove forever.</p>
        </div>
      </header>

      <div className="options-content">
        <AccountSection
          isAuthenticated={isAuthenticated}
          userInfo={userInfo}
          onLogout={handleLogout}
        />
        <WatermarkSettings settings={settings} onSave={handleSaveSettings} />
        <WebsiteInfoSettings settings={settings} onSave={handleSaveSettings} />
        <CaptureSettings settings={settings} onSave={handleSaveSettings} />
        <UploadSettings settings={settings} onSave={handleSaveSettings} />

        {/* Save indicator */}
        <div className="saved-message">✓ Settings saved</div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<OptionsApp />);
}

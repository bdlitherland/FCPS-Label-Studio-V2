import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root');

function renderStartupError(message: string) {
  if (!rootEl || rootEl.childElementCount > 0) return;
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f1f5f9;padding:24px;font-family:system-ui,sans-serif;color:#1e293b;">
      <div style="background:#fff;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,.08);border:1px solid #e2e8f0;max-width:440px;width:100%;padding:24px;">
        <h1 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#be123c;">Unable to Render Label Studio</h1>
        <p style="margin:0 0 12px;font-size:13px;color:#475569;">An unexpected startup error occurred:</p>
        <pre style="margin:0 0 16px;padding:12px;background:#f8fafc;border-radius:8px;font-size:11px;color:#881337;overflow-x:auto;white-space:pre-wrap;">${message.replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c] || c))}</pre>
        <button onclick="localStorage.removeItem('gfes_print_settings');location.reload();" style="padding:8px 14px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
          Reset Print Settings &amp; Reload
        </button>
      </div>
    </div>
  `;
}

window.addEventListener('error', (event) => {
  renderStartupError(event.message || 'Unknown script error');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  renderStartupError(reason || 'Unhandled promise rejection');
});

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

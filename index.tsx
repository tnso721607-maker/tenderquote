
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Fatal Error: Could not find root element '#root' in the DOM.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("SmartRate Estimator: Successfully mounted.");
  } catch (error) {
    console.error("Failed to render React application:", error);
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 40px; font-family: sans-serif; text-align: center;">
          <h1 style="color: #ef4444;">Startup Error</h1>
          <pre style="text-align: left; background: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 12px; overflow: auto; max-width: 600px; margin: 20px auto;">
            ${error instanceof Error ? error.stack : String(error)}
          </pre>
          <p style="color: #64748b; font-size: 14px;">This usually happens due to missing dependencies or incompatible browser version.</p>
        </div>
      `;
    }
  }
}

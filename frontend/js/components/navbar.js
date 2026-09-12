/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * Hub Navbar & Connection Controller
 */

import { store } from '../state/store.js';
import { api } from '../services/api.js';
import { toast } from './toast.js';

export class NavbarComponent {
  constructor(navElement) {
    this.navElement = navElement;
    this._clockTimer = null;
    this._initClock();
    
    store.subscribe((state, key) => {
      if (key === 'screen' || key === 'refresh' || key === 'apiMode') {
        this.render();
      }
    });
  }

  _initClock() {
    this._clockTimer = setInterval(() => {
      const clockEl = document.getElementById('hub-live-clock');
      if (clockEl) {
        clockEl.textContent = new Date().toLocaleTimeString([], { hour12: false });
      }
    }, 1000);
  }

  render() {
    const { activeScreen, stats, apiMode } = store.getState();
    const unassignedCount = stats ? stats.unassignedParcels : 0;
    const isLive = apiMode === 'live';

    this.navElement.innerHTML = `
      <div class="navbar-inner">
        <!-- Logo & Hub Identifier -->
        <div class="nav-brand">
          <div class="brand-symbol">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
              <polyline points="3.29 7 12 12 20.71 7"></polyline>
              <line x1="12" y1="22" x2="12" y2="12"></line>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-title">TRANSIT TRACKER</span>
            <span class="brand-sub">Warehouse Dispatch Hub Console</span>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="nav-tabs" aria-label="Main Navigation">
          <button 
            class="nav-tab ${activeScreen === 'dashboard' ? 'active' : ''}" 
            data-screen="dashboard"
            id="tab-dashboard"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Dashboard
          </button>

          <button 
            class="nav-tab ${activeScreen === 'intake' ? 'active' : ''}" 
            data-screen="intake"
            id="tab-intake"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Inbound Intake
          </button>

          <button 
            class="nav-tab ${activeScreen === 'loading-bay' ? 'active' : ''}" 
            data-screen="loading-bay"
            id="tab-loading-bay"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            Van Loading Bay
            ${unassignedCount > 0 ? `<span class="tab-badge">${unassignedCount}</span>` : ''}
          </button>
        </nav>

        <!-- Hub Status & Mode Controls -->
        <div class="nav-controls">
          <!-- Live Time Display -->
          <div class="hub-clock-wrap">
            <span class="clock-label">HUB TIME:</span>
            <span class="mono-font clock-time" id="hub-live-clock">
              ${new Date().toLocaleTimeString([], { hour12: false })}
            </span>
          </div>

          <!-- API Mode Pill (Live vs Mock) -->
          <div class="api-mode-switch">
            <button 
              id="btn-toggle-mode" 
              class="mode-toggle-btn ${isLive ? 'mode-live' : 'mode-mock'}" 
              title="Click to toggle between Mock Hub and Live Backend API"
            >
              <span class="mode-indicator-dot"></span>
              <span class="mode-text">${isLive ? 'LIVE API (5000)' : 'SIMULATED HUB'}</span>
            </button>
          </div>

          <!-- Reset Seed Data Button -->
          <button 
            id="btn-reset-data" 
            class="btn btn-xs btn-ghost" 
            title="Reset hub state to initial demo seed data"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Reset Demo
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.navElement.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const screen = e.currentTarget.dataset.screen;
        store.setScreen(screen);
      });
    });

    const toggleModeBtn = this.navElement.querySelector('#btn-toggle-mode');
    if (toggleModeBtn) {
      toggleModeBtn.addEventListener('click', () => {
        const currentMode = store.getState().apiMode;
        const newMode = currentMode === 'live' ? 'mock' : 'live';
        store.setApiMode(newMode);
        toast.info(
          `Switched to ${newMode.toUpperCase()} mode (${newMode === 'live' ? api.getBaseUrl() : 'Client Simulator'}).`,
          'API Mode Changed'
        );
      });
    }

    const resetBtn = this.navElement.querySelector('#btn-reset-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset warehouse hub data back to demo state?')) {
          store.resetDemoData();
          toast.success('Hub seed data restored.', 'Demo Reset');
        }
      });
    }
  }
}

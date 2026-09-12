/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * Screen 2: Inbound Intake Page
 */

import { api } from '../services/api.js';
import { store } from '../state/store.js';
import { toast } from '../components/toast.js';

export class IntakePage {
  constructor(container) {
    this.container = container;
    this.lastRegistered = null;
    this.recentlyRegistered = [];
  }

  render() {
    this.container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Inbound Parcel Intake</h1>
          <p class="page-subtitle">Manual entry station &bull; Authoritative backend zone classification</p>
        </div>
        <div class="manual-notice-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <path d="M7 15h0M12 15h0M17 15h0M7 11h0M12 11h0M17 11h0"></path>
          </svg>
          No Barcode Scanner &bull; Manual Hub Entry
        </div>
      </div>

      <div class="intake-grid">
        <!-- Intake Form Card -->
        <div class="hub-card">
          <div class="hub-card-header">
            <div>
              <h2 class="hub-card-title">Register Inbound Parcel</h2>
              <p class="hub-card-subtitle">All parcel codes must be manually inputted by warehouse staff</p>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" id="btn-generate-code" title="Generate next sequential code for testing">
              Auto-suggest Code
            </button>
          </div>

          <form id="intake-form" class="intake-form" novalidate>
            <!-- Tracking Code -->
            <div class="form-group">
              <label for="input-tracking-code" class="form-label">
                Parcel Tracking Code <span class="req">*</span>
              </label>
              <div class="input-with-icon">
                <span class="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                  </svg>
                </span>
                <input 
                  type="text" 
                  id="input-tracking-code" 
                  name="trackingCode" 
                  class="form-control mono-font" 
                  placeholder="e.g. PKG-50821" 
                  autocomplete="off"
                  required
                />
              </div>
              <span class="form-hint">Unique alpha-numeric tracking identifier. Case-insensitive.</span>
              <div class="field-error" id="error-tracking-code"></div>
            </div>

            <!-- Destination PIN Code -->
            <div class="form-group">
              <label for="input-pin-code" class="form-label">
                Destination Postal PIN Code <span class="req">*</span>
              </label>
              <div class="input-with-icon">
                <span class="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </span>
                <input 
                  type="text" 
                  id="input-pin-code" 
                  name="pinCode" 
                  class="form-control mono-font" 
                  placeholder="e.g. 110001 (6 digits)" 
                  maxlength="6"
                  autocomplete="off"
                  required
                />
              </div>
              <span class="form-hint">Must be exactly 6 numeric digits. Backend uses this to assign zone.</span>
              <div class="field-error" id="error-pin-code"></div>
            </div>

            <!-- Parcel Weight (kg) -->
            <div class="form-group">
              <label for="input-weight" class="form-label">
                Parcel Weight (kg) <span class="req">*</span>
              </label>
              <div class="input-with-icon">
                <span class="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                </span>
                <input 
                  type="number" 
                  id="input-weight" 
                  name="weightKg" 
                  class="form-control" 
                  placeholder="e.g. 14.5" 
                  step="0.1" 
                  min="0.1"
                  max="150"
                  required
                />
              </div>
              <span class="form-hint">Gross package weight in kilograms (must be &gt; 0).</span>
              <div class="field-error" id="error-weight"></div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary btn-lg btn-block" id="btn-submit-parcel">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Register Parcel
              </button>
            </div>
          </form>

          <!-- General Alert Box -->
          <div id="intake-general-alert" class="alert-box" style="display: none;"></div>
        </div>

        <!-- Right Side: Registration Result & Recent Staging -->
        <div class="intake-sidebar">
          <!-- Success Confirmation Card -->
          <div id="registration-success-card" class="hub-card success-banner-card ${this.lastRegistered ? '' : 'hidden'}">
            ${this.renderSuccessCardContent()}
          </div>

          <!-- Quick Test Helpers -->
          <div class="hub-card">
            <div class="hub-card-header">
              <h3 class="hub-card-title text-sm">Zone Reference &amp; Test PINs</h3>
            </div>
            <div class="zone-pins-reference">
              <div class="zone-pin-item" data-pin="110001">
                <span class="zone-tag zone-north-zone">North Zone</span>
                <span class="mono-font text-muted">PIN: 110001 (Delhi / NCR)</span>
              </div>
              <div class="zone-pin-item" data-pin="560001">
                <span class="zone-tag zone-south-zone">South Zone</span>
                <span class="mono-font text-muted">PIN: 560001 (Bangalore)</span>
              </div>
              <div class="zone-pin-item" data-pin="400001">
                <span class="zone-tag zone-west-zone">West Zone</span>
                <span class="mono-font text-muted">PIN: 400001 (Mumbai)</span>
              </div>
              <div class="zone-pin-item" data-pin="700001">
                <span class="zone-tag zone-east-zone">East Zone</span>
                <span class="mono-font text-muted">PIN: 700001 (Kolkata)</span>
              </div>
            </div>
          </div>

          <!-- Recently Registered in this Shift -->
          <div class="hub-card">
            <div class="hub-card-header">
              <h3 class="hub-card-title text-sm">Session Intake Log</h3>
              <span class="badge badge-neutral">${this.recentlyRegistered.length} logged</span>
            </div>
            <div class="session-log-list">
              ${this.recentlyRegistered.length === 0 ? `
                <div class="empty-feed text-sm">Parcels registered during this session will appear here.</div>
              ` : this.recentlyRegistered.map(p => `
                <div class="session-log-row">
                  <span class="mono-font font-bold">${p.trackingCode}</span>
                  <span class="zone-tag zone-${p.zone.replace(/\s+/g, '-').toLowerCase()}">${p.zone}</span>
                  <span class="text-muted text-sm">${p.weightKg} kg</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  renderSuccessCardContent() {
    if (!this.lastRegistered) return '';

    const p = this.lastRegistered;
    return `
      <div class="success-card-badge">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <div class="success-card-body">
        <h3 class="success-card-title">Parcel registered successfully</h3>
        <p class="success-card-subtitle">Staged as <code>UNASSIGNED</code> in warehouse hub registry</p>
        
        <div class="success-meta-grid">
          <div class="success-meta-item">
            <span class="label">Tracking Code:</span>
            <span class="value mono-font font-bold">${p.trackingCode}</span>
          </div>
          <div class="success-meta-item">
            <span class="label">Destination PIN:</span>
            <span class="value mono-font">${p.pinCode}</span>
          </div>
          <div class="success-meta-item">
            <span class="label">Gross Weight:</span>
            <span class="value">${p.weightKg} kg</span>
          </div>
          <div class="success-meta-item">
            <span class="label">Backend Assigned:</span>
            <span class="value zone-tag zone-${p.zone.replace(/\s+/g, '-').toLowerCase()} font-bold">Zone: ${p.zone}</span>
          </div>
        </div>

        <div class="success-card-actions">
          <button class="btn btn-sm btn-outline" id="btn-goto-loading-bay">
            Proceed to Loading Bay &rarr;
          </button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const form = this.container.querySelector('#intake-form');
    const trackingInput = this.container.querySelector('#input-tracking-code');
    const pinInput = this.container.querySelector('#input-pin-code');
    const weightInput = this.container.querySelector('#input-weight');
    const autoCodeBtn = this.container.querySelector('#btn-generate-code');

    // Auto capitalize tracking code
    if (trackingInput) {
      trackingInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
        this._clearFieldError('tracking-code');
      });
    }

    if (pinInput) {
      pinInput.addEventListener('input', (e) => {
        // Digits only
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        this._clearFieldError('pin-code');
      });
    }

    if (weightInput) {
      weightInput.addEventListener('input', () => {
        this._clearFieldError('weight');
      });
    }

    // Auto-suggest next tracking code
    if (autoCodeBtn && trackingInput) {
      autoCodeBtn.addEventListener('click', () => {
        const rand = Math.floor(10000 + Math.random() * 90000);
        trackingInput.value = `PKG-${rand}`;
        trackingInput.focus();
        this._clearFieldError('tracking-code');
      });
    }

    // Quick fill PIN by clicking reference items
    this.container.querySelectorAll('.zone-pin-item').forEach(item => {
      item.addEventListener('click', () => {
        const pin = item.dataset.pin;
        if (pinInput) {
          pinInput.value = pin;
          pinInput.focus();
          this._clearFieldError('pin-code');
        }
      });
    });

    // Go to loading bay action
    const gotoBayBtn = this.container.querySelector('#btn-goto-loading-bay');
    if (gotoBayBtn) {
      gotoBayBtn.addEventListener('click', () => {
        store.setScreen('loading-bay');
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this._handleSubmit();
      });
    }
  }

  _clearFieldError(fieldName) {
    const el = this.container.querySelector(`#error-${fieldName}`);
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  _setFieldError(fieldName, msg) {
    const el = this.container.querySelector(`#error-${fieldName}`);
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  async _handleSubmit() {
    const trackingInput = this.container.querySelector('#input-tracking-code');
    const pinInput = this.container.querySelector('#input-pin-code');
    const weightInput = this.container.querySelector('#input-weight');
    const submitBtn = this.container.querySelector('#btn-submit-parcel');
    const generalAlert = this.container.querySelector('#intake-general-alert');

    generalAlert.style.display = 'none';
    this._clearFieldError('tracking-code');
    this._clearFieldError('pin-code');
    this._clearFieldError('weight');

    const trackingCode = (trackingInput.value || '').trim().toUpperCase();
    const pinCode = (pinInput.value || '').trim();
    const weightVal = parseFloat(weightInput.value);

    // Mandatory Frontend Validation
    let hasError = false;
    if (!trackingCode) {
      this._setFieldError('tracking-code', 'Tracking code is required.');
      hasError = true;
    }

    if (!pinCode) {
      this._setFieldError('pin-code', 'Destination PIN code is required.');
      hasError = true;
    } else if (!/^\d{6}$/.test(pinCode)) {
      this._setFieldError('pin-code', 'PIN must be exactly 6 numeric digits.');
      hasError = true;
    }

    if (isNaN(weightVal) || weightVal <= 0) {
      this._setFieldError('weight', 'Parcel weight is required and must be greater than 0 kg.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-small"></span> Registering with Backend...`;

    try {
      const response = await api.registerParcel({
        trackingCode,
        pinCode,
        weightKg: weightVal,
      });

      const parcel = response.parcel;
      this.lastRegistered = parcel;
      this.recentlyRegistered.unshift(parcel);

      toast.success(
        `Parcel ${parcel.trackingCode} registered! Zone: ${parcel.zone}`,
        'Parcel Registered Successfully'
      );

      // Reset form fields
      trackingInput.value = '';
      pinInput.value = '';
      weightInput.value = '';

      // Re-render view to show success box and session list
      this.render();
      await store.refreshAll();
    } catch (err) {
      console.error('Registration failed:', err);
      generalAlert.className = 'alert-box alert-error';
      generalAlert.textContent = err.message || 'Registration failed on backend server.';
      generalAlert.style.display = 'block';
      toast.error(err.message, 'Registration Error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Register Parcel
        `;
      }
    }
  }
}

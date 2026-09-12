/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * Dispatch Confirmation Modal Component
 */

import { store } from '../state/store.js';
import { api } from '../services/api.js';
import { toast } from './toast.js';

export class DispatchModalComponent {
  constructor() {
    this.modalEl = document.getElementById('dispatch-modal');
    this.modalContentEl = document.getElementById('dispatch-modal-body');
    this.confirmBtn = document.getElementById('btn-confirm-dispatch');
    this.cancelBtn = document.getElementById('btn-cancel-dispatch');
    this.closeBtn = document.getElementById('modal-close-btn');

    this._bindEvents();
    store.subscribe((state, key) => {
      if (key === 'dispatchModal') {
        this.render();
      }
    });
  }

  _bindEvents() {
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => store.closeDispatchModal());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => store.closeDispatchModal());
    }
    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) {
          store.closeDispatchModal();
        }
      });
    }
    if (this.confirmBtn) {
      this.confirmBtn.addEventListener('click', () => this.handleConfirm());
    }

    // Escape key closes modal if open
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const { dispatchModal } = store.getState();
        if (dispatchModal.isOpen) {
          store.closeDispatchModal();
        }
      }
    });
  }

  render() {
    const { dispatchModal } = store.getState();
    if (!dispatchModal.isOpen || !dispatchModal.van) {
      this.modalEl.classList.remove('modal-open');
      this.modalEl.setAttribute('aria-hidden', 'true');
      return;
    }

    const van = dispatchModal.van;
    const parcelCount = (van.loadedParcels || []).length;
    const pct = van.maxCapacityKg > 0 ? Math.round((van.currentWeightKg / van.maxCapacityKg) * 100) : 0;

    this.modalContentEl.innerHTML = `
      <div class="dispatch-warning-banner">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <div>
          <strong>Atomic Transit Action</strong>
          <p>Once dispatched, all loaded parcels will atomically transition to <code>IN_TRANSIT</code> and the vehicle will depart. The manifest will be locked from further edits.</p>
        </div>
      </div>

      <div class="dispatch-details-card">
        <div class="dispatch-detail-row">
          <span class="detail-label">Delivery Vehicle:</span>
          <span class="detail-value plate-badge">${van.plate} &bull; ${van.name}</span>
        </div>
        <div class="dispatch-detail-row">
          <span class="detail-label">Assigned Delivery Zone:</span>
          <span class="detail-value zone-tag zone-${van.zone.replace(/\s+/g, '-').toLowerCase()}">${van.zone}</span>
        </div>
        <div class="dispatch-detail-row">
          <span class="detail-label">Loaded Parcels:</span>
          <span class="detail-value font-bold">${parcelCount} parcel${parcelCount === 1 ? '' : 's'}</span>
        </div>
        <div class="dispatch-detail-row">
          <span class="detail-label">Total Dispatch Weight:</span>
          <span class="detail-value font-bold">${van.currentWeightKg} kg</span>
        </div>
        <div class="dispatch-detail-row">
          <span class="detail-label">Vehicle Payload Utilization:</span>
          <span class="detail-value">${van.currentWeightKg} kg / ${van.maxCapacityKg} kg (${pct}%)</span>
        </div>
      </div>

      <div class="dispatch-prompt">
        Are you sure you want to dispatch this van?
      </div>
    `;

    this.modalEl.classList.add('modal-open');
    this.modalEl.setAttribute('aria-hidden', 'false');
  }

  async handleConfirm() {
    const { dispatchModal } = store.getState();
    const van = dispatchModal.van;
    if (!van) return;

    this.confirmBtn.disabled = true;
    this.confirmBtn.innerHTML = `
      <span class="spinner-small"></span> Dispatching...
    `;

    try {
      const result = await api.dispatchVan(van.id);
      
      store.closeDispatchModal();
      toast.success(
        `Van ${van.plate} dispatched with ${result.dispatchedCount} parcels in transit!`,
        'Trip Dispatched Successfully'
      );
      await store.refreshAll();
    } catch (err) {
      console.error('Dispatch failed:', err);
      toast.error(err.message || 'Dispatch failed on backend', 'Dispatch Error');
    } finally {
      this.confirmBtn.disabled = false;
      this.confirmBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        Confirm & Dispatch
      `;
    }
  }
}

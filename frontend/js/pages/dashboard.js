/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * Screen 1: Logistics Dashboard Page
 */

import { store } from '../state/store.js';
import { VAN_STATUS } from '../types/constants.js';

export class DashboardPage {
  constructor(container) {
    this.container = container;
  }

  render() {
    const { stats, vans, auditLogs, isLoading } = store.getState();

    if (isLoading && !stats) {
      this.container.innerHTML = `
        <div class="loading-spinner-state">
          <div class="hub-spinner"></div>
          <p>Connecting to Logistics Hub Console...</p>
        </div>
      `;
      return;
    }

    const s = stats || {
      totalParcels: 0,
      unassignedParcels: 0,
      loadedParcels: 0,
      inTransitParcels: 0,
      availableVans: 0,
      totalMaxCapacity: 0,
      totalCurrentWeight: 0,
      fleetCapacityPct: 0,
    };

    this.container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Warehouse Hub Operations Console</h1>
          <p class="page-subtitle">Real-time parcel sorting, bay loading, and dispatch metrics</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" id="btn-quick-intake">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Inbound Intake
          </button>
          <button class="btn btn-primary" id="btn-quick-loading-bay">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            Open Loading Bay
          </button>
        </div>
      </div>

      <!-- KPI Metrics Cards Grid -->
      <section class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Total Registered</span>
            <div class="kpi-icon-badge badge-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m7.5 4.27 9 5.15"></path>
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                <path d="m3.3 7 8.7 5 8.7-5"></path>
                <path d="M12 22V12"></path>
              </svg>
            </div>
          </div>
          <div class="kpi-value">${s.totalParcels}</div>
          <div class="kpi-footer">Across all hub zones</div>
        </div>

        <div class="kpi-card highlight-amber">
          <div class="kpi-header">
            <span class="kpi-title">Unassigned Parcels</span>
            <div class="kpi-icon-badge badge-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
          </div>
          <div class="kpi-value">${s.unassignedParcels}</div>
          <div class="kpi-footer">Awaiting van assignment</div>
        </div>

        <div class="kpi-card highlight-cyan">
          <div class="kpi-header">
            <span class="kpi-title">Loaded in Vans</span>
            <div class="kpi-icon-badge badge-cyan">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
          <div class="kpi-value">${s.loadedParcels}</div>
          <div class="kpi-footer">Staged in active manifests</div>
        </div>

        <div class="kpi-card highlight-green">
          <div class="kpi-header">
            <span class="kpi-title">In-Transit Parcels</span>
            <div class="kpi-icon-badge badge-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </div>
          </div>
          <div class="kpi-value">${s.inTransitParcels}</div>
          <div class="kpi-footer">Atomically dispatched</div>
        </div>

        <div class="kpi-card highlight-purple">
          <div class="kpi-header">
            <span class="kpi-title">Available Vans</span>
            <div class="kpi-icon-badge badge-purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
          </div>
          <div class="kpi-value">${s.availableVans} / ${vans.length}</div>
          <div class="kpi-footer">Ready at dispatch bays</div>
        </div>
      </section>

      <!-- Fleet Overview & Activity Section -->
      <div class="dashboard-split-grid">
        <!-- Delivery Fleet Status -->
        <div class="hub-card">
          <div class="hub-card-header">
            <div>
              <h2 class="hub-card-title">Hub Delivery Fleet Status</h2>
              <p class="hub-card-subtitle">Active bay assignment and payload capacity</p>
            </div>
            <span class="badge badge-neutral">${vans.length} Vehicles</span>
          </div>

          <div class="fleet-cards-grid">
            ${vans.map(van => {
              const capPct = van.maxCapacityKg > 0 ? Math.round((van.currentWeightKg / van.maxCapacityKg) * 100) : 0;
              const remainingKg = Math.max(0, Math.round((van.maxCapacityKg - van.currentWeightKg) * 10) / 10);
              const isDispatched = van.status === VAN_STATUS.DISPATCHED;
              const parcelCount = (van.loadedParcels || []).length;
              
              let statusBadgeClass = 'status-available';
              if (isDispatched) statusBadgeClass = 'status-dispatched';
              else if (van.status === VAN_STATUS.LOADING) statusBadgeClass = 'status-loading';

              return `
                <div class="van-status-card ${isDispatched ? 'van-card-dispatched' : ''}">
                  <div class="van-card-top">
                    <div>
                      <div class="van-plate-code">${van.plate}</div>
                      <div class="van-name-sub">${van.name}</div>
                    </div>
                    <span class="van-status-pill ${statusBadgeClass}">${van.status}</span>
                  </div>

                  <div class="van-zone-row">
                    <span class="zone-tag zone-${van.zone.replace(/\s+/g, '-').toLowerCase()}">${van.zone}</span>
                    <span class="van-parcel-count">${parcelCount} parcel${parcelCount === 1 ? '' : 's'}</span>
                  </div>

                  <div class="van-capacity-summary">
                    <div class="capacity-labels">
                      <span>Payload: <strong>${van.currentWeightKg} kg / ${van.maxCapacityKg} kg</strong></span>
                      <span class="capacity-pct font-bold">${capPct}%</span>
                    </div>
                    <div class="capacity-track">
                      <div class="capacity-fill ${capPct > 90 ? 'fill-danger' : capPct > 70 ? 'fill-warning' : 'fill-normal'}" 
                           style="width: ${Math.min(100, capPct)}%"></div>
                    </div>
                    <div class="capacity-remaining-sub">${remainingKg} kg remaining capacity</div>
                  </div>

                  <div class="van-card-action">
                    ${isDispatched 
                      ? `<button class="btn btn-sm btn-disabled" disabled>Departed &bull; Manifest Locked</button>`
                      : `<button class="btn btn-sm btn-outline btn-manage-van" data-van-id="${van.id}">
                          Load This Van
                        </button>`
                    }
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Recent Activity Feed -->
        <div class="hub-card">
          <div class="hub-card-header">
            <div>
              <h2 class="hub-card-title">Recent Hub Activity</h2>
              <p class="hub-card-subtitle">Live audit trail of intake and dispatch actions</p>
            </div>
            <button class="btn btn-sm btn-ghost" id="btn-refresh-dashboard" title="Refresh metrics">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </button>
          </div>

          <div class="activity-feed-list">
            ${auditLogs.length === 0 ? `
              <div class="empty-feed">No activity recorded yet for this shift.</div>
            ` : auditLogs.slice(0, 10).map(log => {
              const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              let typeClass = 'log-info';
              if (log.type === 'INTAKE') typeClass = 'log-intake';
              else if (log.type === 'LOAD') typeClass = 'log-load';
              else if (log.type === 'DISPATCH') typeClass = 'log-dispatch';
              else if (log.type === 'UNLOAD') typeClass = 'log-unload';

              return `
                <div class="activity-feed-item">
                  <div class="activity-dot ${typeClass}"></div>
                  <div class="activity-body">
                    <div class="activity-msg">${log.message}</div>
                    <div class="activity-meta">
                      <span class="activity-time">${timeStr}</span>
                      <span class="activity-tag">${log.type}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const intakeBtn = this.container.querySelector('#btn-quick-intake');
    if (intakeBtn) {
      intakeBtn.addEventListener('click', () => store.setScreen('intake'));
    }

    const bayBtn = this.container.querySelector('#btn-quick-loading-bay');
    if (bayBtn) {
      bayBtn.addEventListener('click', () => store.setScreen('loading-bay'));
    }

    const refreshBtn = this.container.querySelector('#btn-refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => store.refreshAll());
    }

    this.container.querySelectorAll('.btn-manage-van').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const vanId = e.currentTarget.dataset.vanId;
        store.setSelectedVan(vanId);
        store.setScreen('loading-bay');
      });
    });
  }
}

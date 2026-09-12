/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * Screen 3: Van Loading Bay (Split Screen Interface)
 */

import { store } from '../state/store.js';
import { api } from '../services/api.js';
import { toast } from '../components/toast.js';
import { VAN_STATUS, ZONES } from '../types/constants.js';

export class LoadingBayPage {
  constructor(container) {
    this.container = container;
  }

  render() {
    const { vans, selectedVanId, unassignedParcels, zoneFilter, searchQuery } = store.getState();
    const selectedVan = vans.find(v => v.id === selectedVanId) || vans[0];

    // Filter available parcels on the left side
    let filteredParcels = unassignedParcels;
    if (zoneFilter && zoneFilter !== 'ALL') {
      filteredParcels = filteredParcels.filter(p => p.zone === zoneFilter);
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      filteredParcels = filteredParcels.filter(p => 
        p.trackingCode.toUpperCase().includes(q) || p.pinCode.includes(q)
      );
    }

    // Capacity calculations for selected van
    const maxCap = selectedVan ? selectedVan.maxCapacityKg : 100;
    const currentWeight = selectedVan ? selectedVan.currentWeightKg : 0;
    const remainingCap = Math.max(0, Math.round((maxCap - currentWeight) * 10) / 10);
    const capacityPct = maxCap > 0 ? Math.min(100, Math.round((currentWeight / maxCap) * 100)) : 0;
    const isDispatched = selectedVan ? selectedVan.status === VAN_STATUS.DISPATCHED : false;
    const manifestItems = selectedVan ? (selectedVan.loadedParcels || []) : [];

    let capacityColorClass = 'fill-normal';
    if (capacityPct > 90) capacityColorClass = 'fill-danger';
    else if (capacityPct > 70) capacityColorClass = 'fill-warning';

    this.container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Van Loading Bay &amp; Manifest Staging</h1>
          <p class="page-subtitle">Assign unassigned parcels, verify zone and payload rules, and dispatch trips</p>
        </div>
        <div class="bay-header-actions">
          <label for="van-selector" class="sr-only">Select Delivery Van</label>
          <div class="van-picker-wrap">
            <span class="picker-label">Active Bay Vehicle:</span>
            <select id="van-selector" class="form-control form-control-sm mono-font">
              ${vans.map(v => `
                <option value="${v.id}" ${v.id === selectedVan?.id ? 'selected' : ''}>
                  ${v.plate} &bull; ${v.name} (${v.zone}) [${v.status}]
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Split Screen Bay Container -->
      <div class="loading-bay-split">
        
        <!-- ============================================ -->
        <!-- LEFT SIDE: Available / Unassigned Parcels    -->
        <!-- ============================================ -->
        <section class="bay-panel bay-panel-left" aria-label="Available Staged Parcels">
          <div class="panel-header">
            <div class="panel-title-group">
              <h2 class="panel-title">Available Staged Parcels</h2>
              <span class="badge badge-amber" id="unassigned-counter">${unassignedParcels.length} unassigned</span>
            </div>
            <p class="panel-desc">Select parcels matching active van's zone (${selectedVan ? selectedVan.zone : 'Any'})</p>
          </div>

          <!-- Direct Manual Add by Tracking Code Form -->
          <div class="manual-add-card">
            <label for="input-manual-tracking" class="manual-add-label">
              Manual "Add by Tracking Code" (Warehouse Staff Entry):
            </label>
            <form id="form-manual-load" class="manual-add-form">
              <div class="input-with-icon flex-grow">
                <span class="input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                    <path d="M7 15h0M12 15h0M17 15h0M7 11h0M12 11h0M17 11h0"></path>
                  </svg>
                </span>
                <input 
                  type="text" 
                  id="input-manual-tracking" 
                  class="form-control mono-font" 
                  placeholder="Enter tracking code (e.g. PKG-10824)" 
                  autocomplete="off"
                  ${isDispatched ? 'disabled' : ''}
                />
              </div>
              <button type="submit" class="btn btn-primary" id="btn-manual-add" ${isDispatched ? 'disabled' : ''}>
                Load Parcel
              </button>
            </form>
            <div id="manual-load-error" class="field-error"></div>
          </div>

          <!-- Filter & Search Controls -->
          <div class="parcels-filter-bar">
            <!-- Search by Tracking Code -->
            <div class="search-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                id="search-parcels" 
                class="form-control form-control-sm" 
                placeholder="Filter unassigned parcels..." 
                value="${searchQuery || ''}"
              />
            </div>

            <!-- Zone Filter Buttons -->
            <div class="zone-filter-pills" role="tablist">
              <button class="filter-pill ${zoneFilter === 'ALL' ? 'active' : ''}" data-zone="ALL">All Zones</button>
              <button class="filter-pill ${zoneFilter === ZONES.NORTH ? 'active' : ''}" data-zone="${ZONES.NORTH}">North</button>
              <button class="filter-pill ${zoneFilter === ZONES.SOUTH ? 'active' : ''}" data-zone="${ZONES.SOUTH}">South</button>
              <button class="filter-pill ${zoneFilter === ZONES.WEST ? 'active' : ''}" data-zone="${ZONES.WEST}">West</button>
              <button class="filter-pill ${zoneFilter === ZONES.EAST ? 'active' : ''}" data-zone="${ZONES.EAST}">East</button>
            </div>
          </div>

          <!-- Staged Parcels Table / List -->
          <div class="parcels-table-scroll" id="parcels-table-container">
            ${this._renderParcelsTableHTML(filteredParcels, selectedVan, remainingCap, isDispatched)}
          </div>
        </section>

        <!-- ============================================ -->
        <!-- RIGHT SIDE: Selected Van & Trip Manifest     -->
        <!-- ============================================ -->
        <section class="bay-panel bay-panel-right" aria-label="Selected Van Manifest">
          ${!selectedVan ? `
            <div class="empty-parcels-state">No vehicle selected.</div>
          ` : `
            <!-- Van Header Card -->
            <div class="selected-van-banner">
              <div class="van-banner-top">
                <div>
                  <div class="van-plate-hero mono-font">${selectedVan.plate}</div>
                  <div class="van-name-hero">${selectedVan.name}</div>
                </div>
                <div class="van-banner-badges">
                  <span class="zone-tag zone-${selectedVan.zone.replace(/\s+/g, '-').toLowerCase()} text-base">
                    ${selectedVan.zone}
                  </span>
                  <span class="van-status-pill ${
                    isDispatched ? 'status-dispatched' : selectedVan.status === VAN_STATUS.LOADING ? 'status-loading' : 'status-available'
                  }">
                    ${selectedVan.status}
                  </span>
                </div>
              </div>

              <!-- Capacity Visualization Box -->
              <div class="capacity-visualizer-card">
                <div class="capacity-stats-row">
                  <div class="stat-block">
                    <span class="stat-sub">Current Weight</span>
                    <span class="stat-main text-accent">${currentWeight} kg</span>
                  </div>
                  <div class="stat-divider">/</div>
                  <div class="stat-block">
                    <span class="stat-sub">Max Capacity</span>
                    <span class="stat-main">${maxCap} kg</span>
                  </div>
                  <div class="stat-block ml-auto text-right">
                    <span class="stat-sub">Payload Used</span>
                    <span class="stat-main">${capacityPct}%</span>
                  </div>
                </div>

                <!-- Progress Bar Gauge -->
                <div class="capacity-gauge-track">
                  <div 
                    class="capacity-gauge-fill ${capacityColorClass}" 
                    style="width: ${capacityPct}%"
                  ></div>
                </div>

                <div class="capacity-footer-row">
                  <span class="capacity-calc-sample">
                    <strong>${currentWeight} kg / ${maxCap} kg</strong> (${capacityPct}% capacity used)
                  </span>
                  <span class="remaining-highlight ${remainingCap < 15 ? 'text-danger' : 'text-success'}">
                    ${remainingCap} kg remaining
                  </span>
                </div>
              </div>
            </div>

            <!-- Itemized Manifest -->
            <div class="manifest-container">
              <div class="manifest-header">
                <div>
                  <h3 class="manifest-title">Itemized Van Manifest</h3>
                  <span class="manifest-subtitle">${manifestItems.length} loaded parcels staged</span>
                </div>
                ${isDispatched ? `
                  <span class="locked-manifest-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Manifest Locked (Departed)
                  </span>
                ` : ''}
              </div>

              <!-- Itemized List Table -->
              <div class="manifest-table-scroll">
                ${manifestItems.length === 0 ? `
                  <div class="empty-manifest-box">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="1" y="3" width="15" height="13"></rect>
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                      <circle cx="5.5" cy="18.5" r="2.5"></circle>
                      <circle cx="18.5" cy="18.5" r="2.5"></circle>
                    </svg>
                    <p>This van's manifest is currently empty.</p>
                    <span class="text-muted text-sm">Add eligible ${selectedVan.zone} parcels from the left bay to stage.</span>
                  </div>
                ` : `
                  <table class="hub-table manifest-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tracking Code</th>
                        <th>PIN</th>
                        <th>Weight</th>
                        <th class="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${manifestItems.map((item, index) => `
                        <tr>
                          <td class="text-muted">${index + 1}</td>
                          <td>
                            <span class="mono-font font-bold">${item.trackingCode}</span>
                          </td>
                          <td>
                            <span class="mono-font text-muted">${item.pinCode}</span>
                          </td>
                          <td>
                            <span class="weight-badge">${item.weightKg} kg</span>
                          </td>
                          <td class="text-right">
                            ${isDispatched ? `
                              <span class="badge badge-neutral">In Transit</span>
                            ` : `
                              <button 
                                class="btn btn-xs btn-danger btn-unload-parcel" 
                                data-tracking="${item.trackingCode}"
                                title="Remove parcel from van manifest"
                              >
                                Unload
                              </button>
                            `}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `}
              </div>

              <!-- Dispatch Van Action Footer -->
              <div class="manifest-footer-action">
                ${isDispatched ? `
                  <div class="dispatched-trip-notice">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <div>
                      <strong>Trip Dispatched</strong>
                      <p>Departed on ${new Date(selectedVan.dispatchedAt || Date.now()).toLocaleTimeString()} &bull; Parcels in transit</p>
                    </div>
                  </div>
                ` : `
                  <button 
                    class="btn btn-dispatch-van btn-lg btn-block ${manifestItems.length === 0 ? 'btn-disabled' : ''}" 
                    id="btn-trigger-dispatch"
                    ${manifestItems.length === 0 ? 'disabled' : ''}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    Dispatch Van (${manifestItems.length} parcels &bull; ${currentWeight} kg)
                  </button>
                `}
              </div>
            </div>
          `}
        </section>

      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const { selectedVanId, vans } = store.getState();
    const selectedVan = vans.find(v => v.id === selectedVanId) || vans[0];

    // Van Selector Change
    const vanSelector = this.container.querySelector('#van-selector');
    if (vanSelector) {
      vanSelector.addEventListener('change', (e) => {
        store.setSelectedVan(e.target.value);
        this.render();
      });
    }

    // Zone Filter Pills
    this.container.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const zone = e.currentTarget.dataset.zone;
        store.setZoneFilter(zone);
        this.render();
      });
    });

    // Search input
    const searchInput = this.container.querySelector('#search-parcels');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        store.setSearchQuery(query);
        this._updateFilteredParcelsTable(query);
      });
    }

    // Bind table action buttons
    this._bindTableButtons();

    // Manual load form
    const manualForm = this.container.querySelector('#form-manual-load');
    const manualInput = this.container.querySelector('#input-manual-tracking');
    if (manualForm && manualInput) {
      manualForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = manualInput.value.trim().toUpperCase();
        if (!code) {
          this._setManualError('Please enter a parcel tracking code.');
          return;
        }
        await this._handleLoadParcel(code);
      });
    }

    // Unload parcel action
    this.container.querySelectorAll('.btn-unload-parcel').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const code = e.currentTarget.dataset.tracking;
        await this._handleUnloadParcel(code);
      });
    });

    // Dispatch button
    const dispatchBtn = this.container.querySelector('#btn-trigger-dispatch');
    if (dispatchBtn) {
      dispatchBtn.addEventListener('click', () => {
        if (!selectedVan) return;
        if (!selectedVan.loadedParcels || selectedVan.loadedParcels.length === 0) {
          toast.warning('Cannot dispatch van with an empty manifest.');
          return;
        }
        store.openDispatchModal(selectedVan);
      });
    }
  }

  _renderParcelsTableHTML(parcels, selectedVan, remainingCap, isDispatched) {
    if (parcels.length === 0) {
      return `
        <div class="empty-parcels-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
          </svg>
          <p>No unassigned parcels matching the selected filters.</p>
          <button class="btn btn-sm btn-outline mt-2" id="btn-goto-intake-from-bay">Register New Parcel</button>
        </div>
      `;
    }

    return `
      <table class="hub-table" id="table-unassigned-parcels">
        <thead>
          <tr>
            <th>Tracking Code</th>
            <th>Destination PIN</th>
            <th>Zone</th>
            <th>Weight</th>
            <th class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${parcels.map(p => {
            const isZoneMatch = selectedVan && p.zone === selectedVan.zone;

            return `
              <tr class="parcel-row ${isZoneMatch ? 'zone-match-highlight' : ''}">
                <td>
                  <span class="mono-font font-bold text-accent">${p.trackingCode}</span>
                </td>
                <td>
                  <span class="mono-font text-muted">${p.pinCode}</span>
                </td>
                <td>
                  <span class="zone-tag zone-${p.zone.replace(/\s+/g, '-').toLowerCase()}">${p.zone}</span>
                </td>
                <td>
                  <span class="weight-badge">${p.weightKg} kg</span>
                </td>
                <td class="text-right">
                  <button 
                    class="btn btn-sm btn-primary btn-load-single" 
                    data-tracking="${p.trackingCode}"
                    data-zone="${p.zone}"
                    data-weight="${p.weightKg}"
                    ${isDispatched ? 'disabled title="Van dispatched"' : ''}
                  >
                    Add &rarr;
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  _updateFilteredParcelsTable(query = '') {
    const { vans, selectedVanId, unassignedParcels, zoneFilter } = store.getState();
    const selectedVan = vans.find(v => v.id === selectedVanId) || vans[0];
    const maxCap = selectedVan ? selectedVan.maxCapacityKg : 100;
    const currentWeight = selectedVan ? selectedVan.currentWeightKg : 0;
    const remainingCap = Math.max(0, Math.round((maxCap - currentWeight) * 10) / 10);
    const isDispatched = selectedVan ? selectedVan.status === VAN_STATUS.DISPATCHED : false;

    let filtered = unassignedParcels;
    if (zoneFilter && zoneFilter !== 'ALL') {
      filtered = filtered.filter(p => p.zone === zoneFilter);
    }
    if (query && query.trim()) {
      const q = query.trim().toUpperCase();
      filtered = filtered.filter(p => 
        p.trackingCode.toUpperCase().includes(q) || p.pinCode.includes(q)
      );
    }

    const tableContainer = this.container.querySelector('#parcels-table-container');
    if (tableContainer) {
      tableContainer.innerHTML = this._renderParcelsTableHTML(filtered, selectedVan, remainingCap, isDispatched);
      this._bindTableButtons();
    }

    const counter = this.container.querySelector('#unassigned-counter');
    if (counter) {
      counter.textContent = `${filtered.length} unassigned`;
    }
  }

  _bindTableButtons() {
    this.container.querySelectorAll('.btn-load-single').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const code = e.currentTarget.dataset.tracking;
        await this._handleLoadParcel(code);
      });
    });

    const gotoIntakeBtn = this.container.querySelector('#btn-goto-intake-from-bay');
    if (gotoIntakeBtn) {
      gotoIntakeBtn.addEventListener('click', () => {
        store.setScreen('intake');
      });
    }
  }

  _setManualError(msg) {
    const el = this.container.querySelector('#manual-load-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  _clearManualError() {
    const el = this.container.querySelector('#manual-load-error');
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  async _handleLoadParcel(trackingCode) {
    this._clearManualError();
    const { selectedVanId } = store.getState();
    if (!selectedVanId) {
      toast.error('No delivery vehicle selected.');
      return;
    }

    try {
      const response = await api.loadParcel(selectedVanId, trackingCode);
      toast.success(
        response.message || `Parcel ${trackingCode} loaded successfully`,
        'Loaded into Van'
      );
      
      const manualInput = this.container.querySelector('#input-manual-tracking');
      if (manualInput) manualInput.value = '';

      await store.refreshAll();
      this.render();
    } catch (err) {
      console.error('Failed to load parcel:', err);
      this._setManualError(err.message);
      toast.error(err.message, 'Loading Rejection');
    }
  }

  async _handleUnloadParcel(trackingCode) {
    const { selectedVanId } = store.getState();
    try {
      const response = await api.unloadParcel(selectedVanId, trackingCode);
      toast.info(response.message || `Parcel ${trackingCode} removed from manifest`, 'Parcel Unloaded');
      await store.refreshAll();
      this.render();
    } catch (err) {
      console.error('Failed to unload parcel:', err);
      toast.error(err.message, 'Unload Error');
    }
  }
}

/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * Central Reactive State Store
 */

import { api } from '../services/api.js';

class StateStore {
  constructor() {
    this.state = {
      activeScreen: 'dashboard', // 'dashboard' | 'intake' | 'loading-bay'
      selectedVanId: 'van-nz-01',
      zoneFilter: 'ALL',
      searchQuery: '',
      vans: [],
      unassignedParcels: [],
      stats: null,
      auditLogs: [],
      isLoading: false,
      apiMode: api.getMode(),
      dispatchModal: {
        isOpen: false,
        van: null,
      },
    };

    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changedKey = null) {
    for (const listener of this.listeners) {
      listener(this.state, changedKey);
    }
  }

  getState() {
    return this.state;
  }

  async init() {
    await this.refreshAll();
  }

  async refreshAll() {
    this.state.isLoading = true;
    this.notify('loading');

    try {
      const [vansRes, parcelsRes, statsRes, logsRes] = await Promise.all([
        api.getVans(),
        api.getUnassignedParcels(this.state.zoneFilter === 'ALL' ? null : this.state.zoneFilter),
        api.getDashboardStats(),
        api.getAuditLogs(),
      ]);

      this.state.vans = vansRes.vans || [];
      this.state.unassignedParcels = parcelsRes.parcels || [];
      this.state.stats = statsRes;
      this.state.auditLogs = logsRes || [];

      // Make sure selectedVanId is valid
      if (this.state.vans.length > 0) {
        const currentExists = this.state.vans.some(v => v.id === this.state.selectedVanId);
        if (!currentExists) {
          this.state.selectedVanId = this.state.vans[0].id;
        }
      }
    } catch (err) {
      console.error('Failed to load hub state:', err);
    } finally {
      this.state.isLoading = false;
      this.notify('refresh');
    }
  }

  setScreen(screen) {
    this.state.activeScreen = screen;
    this.notify('screen');
  }

  setSelectedVan(vanId) {
    this.state.selectedVanId = vanId;
    this.notify('selectedVan');
  }

  getSelectedVan() {
    return this.state.vans.find(v => v.id === this.state.selectedVanId) || null;
  }

  setZoneFilter(zone) {
    this.state.zoneFilter = zone;
    this.refreshUnassignedParcels();
  }

  setSearchQuery(query) {
    this.state.searchQuery = query;
    this.notify('search');
  }

  async refreshUnassignedParcels() {
    try {
      const res = await api.getUnassignedParcels(
        this.state.zoneFilter === 'ALL' ? null : this.state.zoneFilter
      );
      this.state.unassignedParcels = res.parcels || [];
      this.notify('parcels');
    } catch (err) {
      console.error('Error refreshing unassigned parcels:', err);
    }
  }

  openDispatchModal(van) {
    this.state.dispatchModal = {
      isOpen: true,
      van,
    };
    this.notify('dispatchModal');
  }

  closeDispatchModal() {
    this.state.dispatchModal = {
      isOpen: false,
      van: null,
    };
    this.notify('dispatchModal');
  }

  setApiMode(mode) {
    api.setMode(mode);
    this.state.apiMode = mode;
    this.notify('apiMode');
    this.refreshAll();
  }

  resetDemoData() {
    api.resetDemoData();
    this.refreshAll();
  }
}

export const store = new StateStore();

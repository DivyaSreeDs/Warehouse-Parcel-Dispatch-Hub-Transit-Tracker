/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * API Service Layer
 * 
 * Supports both Live Backend API calls and an authoritative Mock Hub Engine.
 * If backend is incomplete, seamlessly falls back to mock logic with localStorage persistence.
 */

import {
  ZONES,
  PARCEL_STATUS,
  VAN_STATUS,
  ERROR_MESSAGES,
  determineZoneFromPin,
  INITIAL_VANS,
  INITIAL_PARCELS,
} from '../types/constants.js';

const STORAGE_KEYS = {
  PARCELS: 'hub_tracker_parcels',
  VANS: 'hub_tracker_vans',
  AUDIT: 'hub_tracker_audit',
  API_MODE: 'hub_tracker_api_mode', // 'mock' or 'live'
  BASE_URL: 'hub_tracker_base_url',
};

class HubApiService {
  constructor() {
    this.mode = localStorage.getItem(STORAGE_KEYS.API_MODE) || 'mock';
    this.baseUrl = localStorage.getItem(STORAGE_KEYS.BASE_URL) || 'http://localhost:5000';
    this._initializeMockStorage();
  }

  getMode() {
    return this.mode;
  }

  setMode(newMode) {
    this.mode = newMode === 'live' ? 'live' : 'mock';
    localStorage.setItem(STORAGE_KEYS.API_MODE, this.mode);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  setBaseUrl(url) {
    this.baseUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem(STORAGE_KEYS.BASE_URL, this.baseUrl);
  }

  _initializeMockStorage(force = false) {
    if (force || !localStorage.getItem(STORAGE_KEYS.PARCELS)) {
      localStorage.setItem(STORAGE_KEYS.PARCELS, JSON.stringify(INITIAL_PARCELS));
    }
    if (force || !localStorage.getItem(STORAGE_KEYS.VANS)) {
      localStorage.setItem(STORAGE_KEYS.VANS, JSON.stringify(INITIAL_VANS));
    }
    if (force || !localStorage.getItem(STORAGE_KEYS.AUDIT)) {
      const initialLogs = [
        {
          id: 'log-1',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          type: 'INTAKE',
          message: 'Shift started. Hub received 7 staged inbound parcels.',
          badge: 'INFO',
        },
      ];
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(initialLogs));
    }
  }

  resetDemoData() {
    this._initializeMockStorage(true);
  }

  _getMockParcels() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PARCELS) || '[]');
  }

  _saveMockParcels(parcels) {
    localStorage.setItem(STORAGE_KEYS.PARCELS, JSON.stringify(parcels));
  }

  _getMockVans() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.VANS) || '[]');
  }

  _saveMockVans(vans) {
    localStorage.setItem(STORAGE_KEYS.VANS, JSON.stringify(vans));
  }

  _getMockLogs() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT) || '[]');
  }

  _logActivity(type, message, badge = 'INFO') {
    const logs = this._getMockLogs();
    logs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      badge,
    });
    // Keep last 50 logs
    if (logs.length > 50) logs.length = 50;
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(logs));
  }

  // Generic request handler
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `Server responded with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(`${ERROR_MESSAGES.NETWORK_ERROR} (${this.baseUrl})`);
      }
      throw err;
    }
  }

  // 1. INBOUND INTAKE: POST /api/parcels/inbound
  async registerParcel({ trackingCode, pinCode, weightKg }) {
    const cleanCode = String(trackingCode || '').trim().toUpperCase();
    const cleanPin = String(pinCode || '').trim();
    const weight = parseFloat(weightKg);

    // Frontend validation
    if (!cleanCode) {
      throw new Error(ERROR_MESSAGES.INVALID_TRACKING);
    }
    if (!/^\d{6}$/.test(cleanPin)) {
      throw new Error(ERROR_MESSAGES.INVALID_PIN);
    }
    if (isNaN(weight) || weight <= 0) {
      throw new Error(ERROR_MESSAGES.INVALID_WEIGHT);
    }

    if (this.mode === 'live') {
      try {
        return await this._request('/api/parcels/inbound', {
          method: 'POST',
          body: JSON.stringify({
            trackingCode: cleanCode,
            pinCode: cleanPin,
            weightKg: weight,
          }),
        });
      } catch (err) {
        console.warn('Live API call failed, reporting backend error:', err.message);
        throw err;
      }
    }

    // Mock Backend Implementation (Authoritative Zone Assignment)
    const parcels = this._getMockParcels();
    const existing = parcels.find(p => p.trackingCode.toUpperCase() === cleanCode);
    if (existing) {
      throw new Error(ERROR_MESSAGES.TRACKING_EXISTS);
    }

    // Backend determines zone
    const assignedZone = determineZoneFromPin(cleanPin);

    const newParcel = {
      trackingCode: cleanCode,
      pinCode: cleanPin,
      weightKg: Math.round(weight * 10) / 10,
      zone: assignedZone,
      status: PARCEL_STATUS.UNASSIGNED,
      registeredAt: new Date().toISOString(),
      assignedVanId: null,
    };

    parcels.unshift(newParcel);
    this._saveMockParcels(parcels);

    this._logActivity(
      'INTAKE',
      `Parcel ${cleanCode} registered (${weight} kg, PIN: ${cleanPin}) → Assigned to ${assignedZone}`,
      'SUCCESS'
    );

    return {
      success: true,
      message: 'Parcel registered successfully',
      parcel: newParcel,
    };
  }

  // 2. GET UNASSIGNED PARCELS: GET /api/parcels/unassigned?zone=...
  async getUnassignedParcels(zone = null) {
    if (this.mode === 'live') {
      const query = zone ? `?zone=${encodeURIComponent(zone)}` : '';
      return await this._request(`/api/parcels/unassigned${query}`);
    }

    const parcels = this._getMockParcels();
    let unassigned = parcels.filter(p => p.status === PARCEL_STATUS.UNASSIGNED);
    if (zone && zone !== 'ALL') {
      unassigned = unassigned.filter(p => p.zone === zone);
    }
    return { parcels: unassigned };
  }

  // 3. GET ALL VANS: GET /api/vans
  async getVans() {
    if (this.mode === 'live') {
      return await this._request('/api/vans');
    }

    const vans = this._getMockVans();
    return { vans };
  }

  // 4. GET VAN BY ID: GET /api/vans/{van_id}
  async getVanById(vanId) {
    if (this.mode === 'live') {
      return await this._request(`/api/vans/${vanId}`);
    }

    const vans = this._getMockVans();
    const van = vans.find(v => v.id === vanId);
    if (!van) throw new Error(`Van ${vanId} not found.`);
    return { van };
  }

  // 5. LOAD PARCEL INTO VAN: POST /api/vans/{van_id}/load-parcel
  async loadParcel(vanId, trackingCode) {
    const cleanCode = String(trackingCode || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new Error(ERROR_MESSAGES.INVALID_TRACKING);
    }

    if (this.mode === 'live') {
      return await this._request(`/api/vans/${vanId}/load-parcel`, {
        method: 'POST',
        body: JSON.stringify({ trackingCode: cleanCode }),
      });
    }

    // Authoritative Mock Backend Validation
    const vans = this._getMockVans();
    const parcels = this._getMockParcels();

    const vanIndex = vans.findIndex(v => v.id === vanId);
    if (vanIndex === -1) {
      throw new Error(`Vehicle ${vanId} not found.`);
    }
    const van = vans[vanIndex];

    if (van.status === VAN_STATUS.DISPATCHED) {
      throw new Error(ERROR_MESSAGES.VAN_ALREADY_DISPATCHED);
    }

    const parcelIndex = parcels.findIndex(p => p.trackingCode.toUpperCase() === cleanCode);
    if (parcelIndex === -1) {
      throw new Error(ERROR_MESSAGES.PARCEL_NOT_FOUND);
    }
    const parcel = parcels[parcelIndex];

    if (parcel.status === PARCEL_STATUS.LOADED) {
      throw new Error(ERROR_MESSAGES.PARCEL_ALREADY_LOADED);
    }
    if (parcel.status === PARCEL_STATUS.IN_TRANSIT) {
      throw new Error(ERROR_MESSAGES.PARCEL_IN_TRANSIT);
    }

    // Zone validation rule
    if (parcel.zone !== van.zone) {
      throw new Error(ERROR_MESSAGES.ZONE_MISMATCH(parcel.zone, van.zone));
    }

    // Weight capacity validation rule
    const remainingCap = van.maxCapacityKg - van.currentWeightKg;
    if (parcel.weightKg > remainingCap) {
      throw new Error(ERROR_MESSAGES.PAYLOAD_EXCEEDED(parcel.weightKg, remainingCap));
    }

    // Transition parcel to LOADED
    parcel.status = PARCEL_STATUS.LOADED;
    parcel.assignedVanId = van.id;
    parcel.loadedAt = new Date().toISOString();

    // Update van manifest & current weight
    van.loadedParcels.push(parcel);
    van.currentWeightKg = Math.round((van.currentWeightKg + parcel.weightKg) * 10) / 10;
    van.status = VAN_STATUS.LOADING;

    this._saveMockParcels(parcels);
    this._saveMockVans(vans);

    this._logActivity(
      'LOAD',
      `Loaded ${cleanCode} (${parcel.weightKg} kg) to ${van.plate} (${van.zone}). New payload: ${van.currentWeightKg}/${van.maxCapacityKg} kg`,
      'INFO'
    );

    return {
      success: true,
      message: `Parcel ${cleanCode} successfully loaded into van ${van.plate}`,
      van,
      parcel,
    };
  }

  // 6. UNLOAD / REMOVE PARCEL FROM VAN
  async unloadParcel(vanId, trackingCode) {
    const cleanCode = String(trackingCode || '').trim().toUpperCase();

    if (this.mode === 'live') {
      return await this._request(`/api/vans/${vanId}/parcels/${cleanCode}`, {
        method: 'DELETE',
      });
    }

    const vans = this._getMockVans();
    const parcels = this._getMockParcels();

    const vanIndex = vans.findIndex(v => v.id === vanId);
    if (vanIndex === -1) throw new Error('Van not found.');
    const van = vans[vanIndex];

    if (van.status === VAN_STATUS.DISPATCHED) {
      throw new Error('Cannot unload from a dispatched vehicle.');
    }

    const loadedIndex = van.loadedParcels.findIndex(p => p.trackingCode.toUpperCase() === cleanCode);
    if (loadedIndex === -1) {
      throw new Error(`Parcel ${cleanCode} is not in this van's manifest.`);
    }

    const [unloadedParcel] = van.loadedParcels.splice(loadedIndex, 1);
    van.currentWeightKg = Math.max(0, Math.round((van.currentWeightKg - unloadedParcel.weightKg) * 10) / 10);
    if (van.loadedParcels.length === 0) {
      van.status = VAN_STATUS.AVAILABLE;
    }

    const parcel = parcels.find(p => p.trackingCode.toUpperCase() === cleanCode);
    if (parcel) {
      parcel.status = PARCEL_STATUS.UNASSIGNED;
      parcel.assignedVanId = null;
      parcel.loadedAt = null;
    }

    this._saveMockParcels(parcels);
    this._saveMockVans(vans);

    this._logActivity(
      'UNLOAD',
      `Unloaded ${cleanCode} (${unloadedParcel.weightKg} kg) from ${van.plate}. Staged as UNASSIGNED.`,
      'WARNING'
    );

    return {
      success: true,
      message: `Parcel ${cleanCode} unloaded successfully`,
      van,
    };
  }

  // 7. ATOMIC DISPATCH VAN: POST /api/vans/{van_id}/dispatch
  async dispatchVan(vanId) {
    if (this.mode === 'live') {
      return await this._request(`/api/vans/${vanId}/dispatch`, {
        method: 'POST',
      });
    }

    const vans = this._getMockVans();
    const parcels = this._getMockParcels();

    const vanIndex = vans.findIndex(v => v.id === vanId);
    if (vanIndex === -1) throw new Error('Van not found.');
    const van = vans[vanIndex];

    if (van.status === VAN_STATUS.DISPATCHED) {
      throw new Error(ERROR_MESSAGES.VAN_ALREADY_DISPATCHED);
    }

    if (!van.loadedParcels || van.loadedParcels.length === 0) {
      throw new Error(ERROR_MESSAGES.EMPTY_MANIFEST);
    }

    // Atomic update: all loaded parcels transition to IN_TRANSIT
    const dispatchedCodes = van.loadedParcels.map(p => p.trackingCode.toUpperCase());
    const nowIso = new Date().toISOString();

    parcels.forEach(p => {
      if (dispatchedCodes.includes(p.trackingCode.toUpperCase())) {
        p.status = PARCEL_STATUS.IN_TRANSIT;
        p.dispatchedAt = nowIso;
      }
    });

    // Van status becomes DISPATCHED
    van.status = VAN_STATUS.DISPATCHED;
    van.dispatchedAt = nowIso;
    van.loadedParcels.forEach(p => {
      p.status = PARCEL_STATUS.IN_TRANSIT;
      p.dispatchedAt = nowIso;
    });

    this._saveMockParcels(parcels);
    this._saveMockVans(vans);

    this._logActivity(
      'DISPATCH',
      `Van ${van.plate} (${van.zone}) DISPATCHED! ${dispatchedCodes.length} parcels (${van.currentWeightKg} kg) transitioned to IN_TRANSIT.`,
      'SUCCESS'
    );

    return {
      success: true,
      message: `Van ${van.plate} successfully dispatched!`,
      van,
      dispatchedCount: dispatchedCodes.length,
      dispatchedParcels: van.loadedParcels,
    };
  }

  // 8. DASHBOARD STATS
  async getDashboardStats() {
    if (this.mode === 'live') {
      try {
        return await this._request('/api/dashboard/stats');
      } catch (err) {
        console.warn('Could not fetch live dashboard stats:', err.message);
      }
    }

    const parcels = this._getMockParcels();
    const vans = this._getMockVans();

    const totalParcels = parcels.length;
    const unassignedParcels = parcels.filter(p => p.status === PARCEL_STATUS.UNASSIGNED).length;
    const loadedParcels = parcels.filter(p => p.status === PARCEL_STATUS.LOADED).length;
    const inTransitParcels = parcels.filter(p => p.status === PARCEL_STATUS.IN_TRANSIT).length;
    const availableVans = vans.filter(v => v.status === VAN_STATUS.AVAILABLE).length;
    const loadingVans = vans.filter(v => v.status === VAN_STATUS.LOADING).length;
    const dispatchedVans = vans.filter(v => v.status === VAN_STATUS.DISPATCHED).length;

    const totalMaxCapacity = vans.reduce((acc, v) => acc + v.maxCapacityKg, 0);
    const totalCurrentWeight = vans.reduce((acc, v) => acc + v.currentWeightKg, 0);
    const fleetCapacityPct = totalMaxCapacity > 0 ? Math.round((totalCurrentWeight / totalMaxCapacity) * 100) : 0;

    return {
      totalParcels,
      unassignedParcels,
      loadedParcels,
      inTransitParcels,
      availableVans,
      loadingVans,
      dispatchedVans,
      totalMaxCapacity,
      totalCurrentWeight: Math.round(totalCurrentWeight * 10) / 10,
      fleetCapacityPct,
    };
  }

  // 9. AUDIT LOGS
  async getAuditLogs() {
    return this._getMockLogs();
  }
}

export const api = new HubApiService();

/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * Global Constants and Enums
 */

export const ZONES = {
  NORTH: 'North Zone',
  SOUTH: 'South Zone',
  EAST: 'East Zone',
  WEST: 'West Zone',
  CENTRAL: 'Central Zone',
};

export const ZONE_COLORS = {
  'North Zone': { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: '#0284c7' },
  'South Zone': { bg: 'rgba(251, 146, 60, 0.15)', text: '#fb923c', border: '#ea580c' },
  'East Zone': { bg: 'rgba(52, 211, 153, 0.15)', text: '#34d399', border: '#059669' },
  'West Zone': { bg: 'rgba(192, 132, 252, 0.15)', text: '#c084fc', border: '#9333ea' },
  'Central Zone': { bg: 'rgba(250, 204, 21, 0.15)', text: '#facc15', border: '#ca8a04' },
};

export const PARCEL_STATUS = {
  UNASSIGNED: 'UNASSIGNED',
  LOADED: 'LOADED',
  IN_TRANSIT: 'IN_TRANSIT',
};

export const VAN_STATUS = {
  AVAILABLE: 'AVAILABLE',
  LOADING: 'LOADING',
  DISPATCHED: 'DISPATCHED',
};

export const ERROR_MESSAGES = {
  INVALID_TRACKING: 'Invalid tracking code format. Code must not be empty.',
  TRACKING_EXISTS: 'Tracking code already exists in the system.',
  PARCEL_NOT_FOUND: 'Parcel not found in warehouse registry.',
  PARCEL_ALREADY_LOADED: 'This parcel is already loaded onto a delivery van.',
  PARCEL_IN_TRANSIT: 'This parcel has already been dispatched in transit.',
  ZONE_MISMATCH: (parcelZone, vanZone) => 
    `Zone mismatch — this parcel belongs to ${parcelZone}, but this van is assigned to ${vanZone}.`,
  PAYLOAD_EXCEEDED: (parcelWeight, remainingCap) => 
    `Vehicle payload exceeded — parcel weight is ${parcelWeight} kg, but only ${remainingCap.toFixed(1)} kg remaining.`,
  EMPTY_MANIFEST: 'Cannot dispatch van with an empty manifest. Please load at least one parcel.',
  VAN_ALREADY_DISPATCHED: 'This vehicle has already departed and cannot accept further parcels.',
  INVALID_PIN: 'Destination PIN code must be exactly 6 numeric digits.',
  INVALID_WEIGHT: 'Parcel weight must be a positive number greater than 0 kg.',
  NETWORK_ERROR: 'Network/API connection failure. Unable to reach warehouse server.',
  SERVER_ERROR: 'Backend server encountered an unexpected error.',
};

/**
 * Backend simulation helper for zone determination
 * PIN prefixes:
 * 11xxxx -> North Zone (Delhi / NCR)
 * 40xxxx -> West Zone (Mumbai)
 * 56xxxx -> South Zone (Bangalore)
 * 70xxxx -> East Zone (Kolkata)
 * Other 1, 2 digits -> North Zone
 * Other 3, 4 digits -> West Zone
 * Other 5, 6 digits -> South Zone
 * Other 7, 8 digits -> East Zone
 * Other 9 digits -> Central Zone
 */
export function determineZoneFromPin(pinCode) {
  const pin = String(pinCode).trim();
  if (pin.startsWith('11') || pin.startsWith('12') || pin.startsWith('13') || pin.startsWith('2')) {
    return ZONES.NORTH;
  }
  if (pin.startsWith('40') || pin.startsWith('41') || pin.startsWith('3')) {
    return ZONES.WEST;
  }
  if (pin.startsWith('56') || pin.startsWith('57') || pin.startsWith('6')) {
    return ZONES.SOUTH;
  }
  if (pin.startsWith('70') || pin.startsWith('71') || pin.startsWith('8')) {
    return ZONES.EAST;
  }
  return ZONES.CENTRAL;
}

export const INITIAL_VANS = [
  {
    id: 'van-nz-01',
    plate: 'DL-01-AX-4821',
    name: 'Van NZ-01 (Express)',
    zone: ZONES.NORTH,
    maxCapacityKg: 100,
    currentWeightKg: 0,
    status: VAN_STATUS.AVAILABLE,
    loadedParcels: [],
    dispatchedAt: null,
  },
  {
    id: 'van-sz-02',
    plate: 'KA-05-MN-9912',
    name: 'Van SZ-02 (Heavy Haul)',
    zone: ZONES.SOUTH,
    maxCapacityKg: 120,
    currentWeightKg: 0,
    status: VAN_STATUS.AVAILABLE,
    loadedParcels: [],
    dispatchedAt: null,
  },
  {
    id: 'van-wz-03',
    plate: 'MH-02-CP-3104',
    name: 'Van WZ-03 (Standard)',
    zone: ZONES.WEST,
    maxCapacityKg: 85,
    currentWeightKg: 0,
    status: VAN_STATUS.AVAILABLE,
    loadedParcels: [],
    dispatchedAt: null,
  },
  {
    id: 'van-ez-04',
    plate: 'WB-09-TR-7643',
    name: 'Van EZ-04 (Cargo)',
    zone: ZONES.EAST,
    maxCapacityKg: 100,
    currentWeightKg: 0,
    status: VAN_STATUS.AVAILABLE,
    loadedParcels: [],
    dispatchedAt: null,
  },
];

export const INITIAL_PARCELS = [
  {
    trackingCode: 'PKG-10824',
    pinCode: '110001',
    zone: ZONES.NORTH,
    weightKg: 24.5,
    status: PARCEL_STATUS.UNASSIGNED,
    registeredAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    assignedVanId: null,
  },
  {
    trackingCode: 'PKG-10825',
    pinCode: '110025',
    zone: ZONES.NORTH,
    weightKg: 18.0,
    status: PARCEL_STATUS.UNASSIGNED,
    registeredAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    assignedVanId: null,
  },
  {
    trackingCode: 'PKG-10826',
    pinCode: '110048',
    zone: ZONES.NORTH,
    weightKg: 25.5,
    status: PARCEL_STATUS.UNASSIGNED,
    registeredAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    assignedVanId: null,
  },
  {
    trackingCode: 'PKG-20411',
    pinCode: '560001',
    zone: ZONES.SOUTH,
    weightKg: 35.0,
    status: PARCEL_STATUS.UNASSIGNED,
    registeredAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    assignedVanId: null,
  },
  {
    trackingCode: 'PKG-20412',
    pinCode: '560034',
    zone: ZONES.SOUTH,
    weightKg: 14.2,
    status: PARCEL_STATUS.UNASSIGNED,
    registeredAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    assignedVanId: null,
  },
  {
    trackingCode: 'PKG-30919',
    pinCode: '400001',
    zone: ZONES.WEST,
    weightKg: 22.0,
    status: PARCEL_STATUS.UNASSIGNED,
    registeredAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    assignedVanId: null,
  },
  {
    trackingCode: 'PKG-40150',
    pinCode: '700001',
    zone: ZONES.EAST,
    weightKg: 12.8,
    status: PARCEL_STATUS.UNASSIGNED,
    registeredAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    assignedVanId: null,
  },
];

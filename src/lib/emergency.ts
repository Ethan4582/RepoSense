export type EmergencyMode = 'OFF' | 'READ_ONLY' | 'MAINTENANCE';

export function getEmergencyMode(): EmergencyMode {
  const value = (process.env.EMERGENCY_MODE ?? 'OFF').trim().toUpperCase();
  if (value === 'READ_ONLY' || value === 'READONLY') return 'READ_ONLY';
  if (value === 'MAINTENANCE') return 'MAINTENANCE';
  return 'OFF';
}

export function writesPaused(): boolean {
  const mode = getEmergencyMode();
  return mode === 'READ_ONLY' || mode === 'MAINTENANCE';
}

export function maintenanceActive(): boolean {
  return getEmergencyMode() === 'MAINTENANCE';
}

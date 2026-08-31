import { api } from '../api/endpoints';

export async function lockFlight(sessionId: string, seasonId: string, flightId: string, quantity: number) {
  return api.createLock({
    resource_type: 'flight_seat',
    flight_id: flightId,
    season_id: seasonId,
    quantity,
    session_id: sessionId,
  });
}

export async function lockBeds(
  sessionId: string,
  seasonId: string,
  accommodationId: string,
  roomTypeId: string,
  quantity: number,
) {
  return api.createLock({
    resource_type: 'bed',
    accommodation_id: accommodationId,
    room_type_id: roomTypeId,
    season_id: seasonId,
    quantity,
    session_id: sessionId,
  });
}

export function startLockKeepalive(sessionId: string) {
  const extend = setInterval(() => {
    api.extendLocks(sessionId).catch(() => {});
  }, 5 * 60 * 1000);
  return () => clearInterval(extend);
}

export async function releaseSession(sessionId: string) {
  try {
    await api.releaseLocks(sessionId);
  } catch {
    /* ignore */
  }
}

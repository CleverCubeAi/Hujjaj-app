import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'hujjaj_booking_drafts';

export type PilgrimDraft = {
  full_name: string;
  full_name_ar: string;
  gender: 'male' | 'female' | '';
  passport_number?: string;
  phone?: string;
  is_mahram?: boolean;
  mahram_for_index?: number | null;
};

export type ExtraDraft = { service_id: string; name: string; price: number; quantity: number };

export type BookingDraft = {
  id: string;
  updatedAt: string;
  step: number;
  clientId?: string;
  newClient?: { full_name: string; full_name_ar: string; phone: string };
  seasonId?: string;
  pilgrims: PilgrimDraft[];
  flightId?: string;
  flightInventoryId?: string;
  accommodationId?: string;
  roomTypeId?: string;
  hotelInventoryIds?: string[];
  extras: ExtraDraft[];
  notes?: string;
  lockSessionId: string;
  createdBookingId?: string;
  bookingNumber?: string;
};

function newSessionId() {
  return `booking-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDraft(partial?: Partial<BookingDraft>): BookingDraft {
  return {
    id: `local-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    step: 0,
    pilgrims: [],
    extras: [],
    lockSessionId: newSessionId(),
    ...partial,
  };
}

export async function listDrafts(): Promise<BookingDraft[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BookingDraft[];
  } catch {
    return [];
  }
}

export async function saveDraft(draft: BookingDraft) {
  const all = await listDrafts();
  const next = { ...draft, updatedAt: new Date().toISOString() };
  const idx = all.findIndex((d) => d.id === draft.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, 20)));
  return next;
}

export async function getDraft(id: string) {
  const all = await listDrafts();
  return all.find((d) => d.id === id) || null;
}

export async function deleteDraft(id: string) {
  const all = await listDrafts();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((d) => d.id !== id)));
}

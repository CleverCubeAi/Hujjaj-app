import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../api/endpoints';

const KEY = 'hujjaj_offline_queue';

export type QueueItem =
  | { id: string; kind: 'photo'; pilgrimId: string; uri: string; name: string; type: string }
  | { id: string; kind: 'draft'; payload: any };

async function read(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

async function write(items: QueueItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueue(item: QueueItem | Omit<QueueItem, 'id'>) {
  const items = await read();
  const withId = 'id' in item ? item : ({ ...item, id: `q-${Date.now()}` } as QueueItem);
  items.push(withId);
  await write(items);
}

export async function flushQueue() {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;
  const items = await read();
  const remain: QueueItem[] = [];
  for (const item of items) {
    try {
      if (item.kind === 'photo') {
        await api.uploadPilgrimFile({ uri: item.uri, name: item.name, type: item.type });
        if (item.pilgrimId) {
          // URL is applied by caller after upload when online; queued photos stay best-effort
        }
      }
    } catch {
      remain.push(item);
    }
  }
  await write(remain);
}

export async function isOnline() {
  const net = await NetInfo.fetch();
  return !!net.isConnected;
}

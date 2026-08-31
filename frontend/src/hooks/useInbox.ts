import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type InboxItem = {
  id: string;
  type: 'booking' | 'payment' | 'message_failed' | 'hold_expiring' | 'subscription';
  created_at: string;
  link: string;
  unread: boolean;
  meta: Record<string, string | number | null>;
};

export type InboxData = {
  items: InboxItem[];
  unread_count: number;
  failed_messages_count: number;
};

const EMPTY: InboxData = { items: [], unread_count: 0, failed_messages_count: 0 };

export function useInbox(enabled: boolean) {
  const [data, setData] = useState<InboxData>(EMPTY);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await api.getNotificationInbox();
      setData({
        items: next.items || [],
        unread_count: next.unread_count || 0,
        failed_messages_count: next.failed_messages_count || 0,
      });
    } catch (error) {
      console.error('Error fetching inbox:', error);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setData(EMPTY);
      return;
    }
    setLoading(true);
    reload().finally(() => setLoading(false));
    const id = window.setInterval(reload, 45000);
    return () => window.clearInterval(id);
  }, [enabled, reload]);

  const markSeen = useCallback(async () => {
    if (!enabled || data.unread_count === 0) return;
    setData((prev) => ({
      ...prev,
      unread_count: 0,
      failed_messages_count: 0,
      items: prev.items.map((item) => ({ ...item, unread: false })),
    }));
    try {
      await api.markNotificationsSeen();
    } catch (error) {
      console.error('Error marking inbox seen:', error);
      reload();
    }
  }, [enabled, data.unread_count, reload]);

  return { ...data, loading, reload, markSeen };
}

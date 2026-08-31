import {
  ActionIcon,
  Box,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarCheck, CreditCard, MessageSquare, AlertTriangle, Wallet } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ar';
import 'dayjs/locale/fr';
import { brand } from '../../theme/brand';
import type { InboxItem } from '../../hooks/useInbox';

dayjs.extend(relativeTime);

const ICONS = {
  booking: CalendarCheck,
  payment: CreditCard,
  message_failed: MessageSquare,
  hold_expiring: AlertTriangle,
  subscription: Wallet,
};

function itemLabel(item: InboxItem, t: (key: string, opts?: Record<string, unknown>) => string) {
  const client = item.meta.client_name ? String(item.meta.client_name) : '';
  const number = item.meta.booking_number ? String(item.meta.booking_number) : '';
  const amount = Number(item.meta.amount) || 0;
  if (item.type === 'booking') {
    return t('notif_new_booking', { number, client: client || '—' });
  }
  if (item.type === 'payment') {
    return t('notif_new_payment', {
      number,
      amount: amount.toLocaleString('en'),
    });
  }
  if (item.type === 'message_failed') {
    return t('notif_message_failed', { name: client || '—' });
  }
  if (item.type === 'hold_expiring') {
    return t('notif_hold_expiring', { number });
  }
  return t('notif_subscription_past_due');
}

export function HeaderNotifications({
  items,
  unreadCount,
  onOpen,
}: {
  items: InboxItem[];
  unreadCount: number;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === 'fr' ? 'fr' : 'ar';

  return (
    <Popover
      width={360}
      position="bottom-end"
      shadow="lg"
      radius="lg"
      onChange={(opened) => {
        if (opened) onOpen();
      }}
    >
      <Popover.Target>
        <Indicator
          inline
          size={18}
          offset={4}
          color="teal"
          disabled={unreadCount === 0}
          label={unreadCount > 9 ? '9+' : unreadCount}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            radius="xl"
            style={{ backgroundColor: '#F3F4F6' }}
            title={t('notifications')}
          >
            <Bell size={20} color={brand.navy} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0} style={{ backgroundColor: brand.ivory, borderColor: brand.border }}>
        <Box px="md" py="sm" style={{ borderBottom: `1px solid ${brand.border}` }}>
          <Text fw={700} size="sm" c={brand.navy}>
            {t('notifications')}
          </Text>
        </Box>
        {items.length === 0 ? (
          <Box p="xl" ta="center">
            <Bell size={28} color={brand.muted} />
            <Text size="sm" c={brand.muted} mt="sm">
              {t('no_notifications')}
            </Text>
          </Box>
        ) : (
          <ScrollArea.Autosize mah={380}>
            <Stack gap={0}>
              {items.map((item) => {
                const Icon = ICONS[item.type];
                return (
                  <UnstyledButton
                    key={item.id}
                    onClick={() => navigate(item.link)}
                    px="md"
                    py="sm"
                    style={{
                      backgroundColor: item.unread ? brand.tealSoft : 'transparent',
                      borderBottom: `1px solid ${brand.border}`,
                      width: '100%',
                    }}
                  >
                    <Box style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Box
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: item.type === 'hold_expiring' || item.type === 'message_failed'
                            ? '#F8EEDC'
                            : brand.tealSoft,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon
                          size={16}
                          color={item.type === 'hold_expiring' || item.type === 'message_failed'
                            ? brand.warning
                            : brand.teal}
                        />
                      </Box>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={item.unread ? 700 : 500} c={brand.navy} lineClamp={2}>
                          {itemLabel(item, t)}
                        </Text>
                        <Text size="xs" c={brand.muted} mt={2}>
                          {dayjs(item.created_at).locale(locale).fromNow()}
                        </Text>
                      </Box>
                    </Box>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

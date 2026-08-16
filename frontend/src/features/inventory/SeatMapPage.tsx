import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Paper,
  Title,
  Stack,
  Group,
  Text,
  Badge,
  Card,
  LoadingOverlay,
  Avatar,
  ThemeIcon,
  Tooltip,
  Box
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { ArrowLeft, Plane, User } from 'lucide-react';
import { formatLocalDate } from '../../lib/dates';

interface SeatMapData {
  inventory: {
    id: string;
    flight: { code: string; departure_city?: string; arrival_city?: string; departure_date?: string; carrier?: string };
    seats_purchased: number;
    seats_sold: number;
    seat_class?: string;
  };
  seats: Array<{
    index: number;
    pilgrim: { id: string; full_name: string; full_name_ar?: string; gender: string; photo_url?: string } | null;
    booking_id: string | null;
    booking_number: string | null;
    used: boolean;
  }>;
}

export function SeatMapPage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<SeatMapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (inventoryId) {
      api.getSeatMap(inventoryId)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [inventoryId]);

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!data) {
    return (
      <Paper p="xl">
        <Text c="dimmed">{t('inventory_not_found') || 'Inventory not found'}</Text>
        <Group mt="md">
          <Badge onClick={() => navigate('/inventory/flight-seats')} style={{ cursor: 'pointer' }}>
            {t('back_to_inventory') || 'Back to Flight Inventory'}
          </Badge>
        </Group>
      </Paper>
    );
  }

  const { inventory, seats } = data;
  const flight = inventory.flight;
  const seatsPerRow = 6; // ABC | aisle | DEF (narrow-body)
  const totalRows = Math.ceil(inventory.seats_purchased / seatsPerRow);

  // Group seats by row: row 0 = seats 0-5, row 1 = seats 6-11, etc.
  const rows: typeof seats[] = [];
  for (let r = 0; r < totalRows; r++) {
    rows.push(seats.slice(r * seatsPerRow, (r + 1) * seatsPerRow));
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <ThemeIcon variant="subtle" size="lg" style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory/flight-seats')}>
            <ArrowLeft size={20} />
          </ThemeIcon>
          <div>
            <Title order={3}>
              {t('seat_map') || 'خريطة المقاعد'}
            </Title>
            <Text size="sm" c="dimmed">
              {flight?.code} — {flight?.departure_city} → {flight?.arrival_city} • {inventory.seats_purchased} {t('seats') || 'مقعد'}
            </Text>
          </div>
        </Group>
        <Group>
          <Badge color="blue">{inventory.seats_sold} {t('occupied') || 'مشغولة'}</Badge>
          <Badge color="green">{inventory.seats_purchased - inventory.seats_sold} {t('available') || 'متاحة'}</Badge>
          {inventory.seat_class && inventory.seat_class !== 'economy' && (
            <Badge variant="light">{t(inventory.seat_class) || inventory.seat_class}</Badge>
          )}
          {flight?.departure_date && (
            <Text size="xs" c="dimmed">
              {formatLocalDate(flight.departure_date)}
            </Text>
          )}
        </Group>
      </Group>

      <Card withBorder p="md">
        <Group>
          <Plane size={24} color="#0C7774" />
          <div>
            <Text fw={600}>{flight?.code} — {flight?.carrier}</Text>
            <Text size="xs" c="dimmed">
              {flight?.departure_city} → {flight?.arrival_city}
            </Text>
          </div>
        </Group>
      </Card>

      {/* Plane-shaped cabin (Airbus-style narrow-body layout) */}
      <Box
        style={{
          position: 'relative',
          padding: '40px 56px 48px',
          background: 'linear-gradient(180deg, #e0dcd4 0%, #f5f0e8 18%, #f5f0e8 82%, #e0dcd4 100%)',
          borderRadius: '50% 50% 45% 45% / 12% 12% 12% 12%',
          border: '2px solid #b8b0a4',
          boxShadow: 'inset 0 0 24px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.08)',
          maxWidth: 480,
          margin: '0 auto'
        }}
      >
        {/* Front / nose */}
        <Group justify="center" mb="xs" gap={4}>
          <Plane size={14} style={{ transform: 'rotate(-90deg)' }} />
          <Text size="xs" c="dimmed">{t('front') || 'أمام'}</Text>
        </Group>
        {/* Column labels: A B C | aisle | D E F */}
        <Group gap={6} mb="xs" justify="center" wrap="nowrap" style={{ paddingLeft: 28 }}>
          <Group gap={6}><Text size="10px" c="dimmed" w={36} ta="center">A</Text><Text size="10px" c="dimmed" w={36} ta="center">B</Text><Text size="10px" c="dimmed" w={36} ta="center">C</Text></Group>
          <Box w={8} />
          <Group gap={6}><Text size="10px" c="dimmed" w={36} ta="center">D</Text><Text size="10px" c="dimmed" w={36} ta="center">E</Text><Text size="10px" c="dimmed" w={36} ta="center">F</Text></Group>
        </Group>
        {/* Seat rows */}
        {rows.map((rowSeats, rowIdx) => (
          <Group key={rowIdx} gap={6} align="center" mb={4} wrap="nowrap" justify="center">
            <Text size="xs" c="dimmed" w={24} ta="right" fw={500}>{rowIdx + 1}</Text>
            <Group gap={6}>
              {rowSeats.slice(0, 3).map((s) => (
                <SeatSlot key={s.index} seat={s} onNavigateToBooking={() => s.booking_id && navigate(`/bookings/${s.booking_id}`)} t={t} />
              ))}
            </Group>
            <Box w={8} style={{ borderLeft: '1px dashed #aaa', height: 28 }} />
            <Group gap={6}>
              {rowSeats.slice(3, 6).map((s) => (
                <SeatSlot key={s.index} seat={s} onNavigateToBooking={() => s.booking_id && navigate(`/bookings/${s.booking_id}`)} t={t} />
              ))}
            </Group>
          </Group>
        ))}
        {/* Rear */}
        <Group justify="center" mt="sm" gap={4}>
          <Text size="xs" c="dimmed">{t('rear') || 'خلف'}</Text>
        </Group>
      </Box>
    </Stack>
  );
}

function SeatSlot({
  seat,
  onNavigateToBooking,
  t
}: {
  seat: SeatMapData['seats'][0];
  onNavigateToBooking: () => void;
  t: (key: string) => string;
}) {
  const pilgrim = seat.pilgrim;
  const name = pilgrim ? (pilgrim.full_name_ar || pilgrim.full_name || '-') : (t('available') || 'متاح');
  const isClickable = seat.used && seat.booking_id;
  const genderColor = pilgrim?.gender === 'male' ? 'blue' : 'pink';

  return (
    <Tooltip label={seat.used ? `${name} • ${seat.booking_number || ''}` : (t('empty_seat') || 'مقعد فارغ')} withArrow>
      <Box
        component={isClickable ? 'button' : 'div'}
        onClick={isClickable ? onNavigateToBooking : undefined}
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          border: seat.used ? `2px solid var(--mantine-color-${genderColor}-6)` : '2px dashed #ccc',
          backgroundColor: seat.used ? `var(--mantine-color-${genderColor}-0)` : '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'transform 0.15s, box-shadow 0.15s',
          padding: 0
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
          if (isClickable) {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {seat.used && pilgrim ? (
          pilgrim.photo_url ? (
            <Avatar
              src={pilgrim.photo_url}
              size={36}
              radius="md"
              color={genderColor}
            >
              {name[0]}
            </Avatar>
          ) : (
            <ThemeIcon size={36} radius="md" color={genderColor} variant="light">
              <User size={20} />
            </ThemeIcon>
          )
        ) : (
          <Text size="xs" c="dimmed">{seat.index + 1}</Text>
        )}
      </Box>
    </Tooltip>
  );
}

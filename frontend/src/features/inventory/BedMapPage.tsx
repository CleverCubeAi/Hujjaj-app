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
  SimpleGrid,
  LoadingOverlay,
  Avatar,
  ThemeIcon,
  Tooltip,
  Box,
  TextInput,
  ActionIcon
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { ArrowLeft, BedDouble, User, Building2, Pencil, Check, X } from 'lucide-react';
import { formatLocalDate } from '../../lib/dates';

interface BedMapData {
  inventory: {
    id: string;
    accommodation: { name: string; name_ar?: string; city?: string };
    room_type: { type: string; total_beds: number };
    beds_purchased: number;
    beds_sold: number;
    check_in_date: string;
    check_out_date: string;
    room_labels: string[];
  };
  beds_per_room: number;
  beds: Array<{
    index: number;
    room_index: number;
    bed_in_room: number;
    pilgrim: { id: string; full_name: string; full_name_ar?: string; gender: string; photo_url?: string } | null;
    booking_id: string | null;
    booking_number: string | null;
    used: boolean;
  }>;
}

export function BedMapPage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<BedMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);

  useEffect(() => {
    if (inventoryId) {
      api.getBedMap(inventoryId)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [inventoryId]);

  const startEditing = (roomIdx: number, currentLabel: string) => {
    setEditingRoom(roomIdx);
    setEditingLabel(currentLabel);
  };

  const cancelEditing = () => {
    setEditingRoom(null);
    setEditingLabel('');
  };

  const saveLabel = async (roomIdx: number) => {
    if (!data || !inventoryId) return;
    setSavingLabel(true);
    try {
      const newLabels = [...(data.inventory.room_labels || [])];
      // Extend array if needed
      while (newLabels.length <= roomIdx) newLabels.push('');
      newLabels[roomIdx] = editingLabel.trim();
      await api.updateHotelInventory(inventoryId, { room_labels: newLabels });
      setData(prev => prev ? {
        ...prev,
        inventory: { ...prev.inventory, room_labels: newLabels }
      } : prev);
      setEditingRoom(null);
    } catch {
      // silently ignore
    } finally {
      setSavingLabel(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!data) {
    return (
      <Paper p="xl">
        <Text c="dimmed">{t('inventory_not_found') || 'Inventory not found'}</Text>
        <Group mt="md">
          <Badge onClick={() => navigate('/inventory/hotel-rooms')} style={{ cursor: 'pointer' }}>
            {t('back_to_inventory') || 'Back to Hotel Inventory'}
          </Badge>
        </Group>
      </Paper>
    );
  }

  const { inventory, beds_per_room, beds } = data;
  const acc = inventory.accommodation;
  const roomType = inventory.room_type;
  const totalRooms = Math.ceil(inventory.beds_purchased / beds_per_room);

  const roomsGrid: BedMapData['beds'][] = [];
  for (let r = 0; r < totalRooms; r++) {
    roomsGrid.push(beds.filter((b) => b.room_index === r));
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <ThemeIcon variant="subtle" size="lg" style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory/hotel-rooms')}>
            <ArrowLeft size={20} />
          </ThemeIcon>
          <div>
            <Title order={3}>
              {t('bed_map') || 'خريطة الأسرة'}
            </Title>
            <Text size="sm" c="dimmed">
              {acc?.name_ar || acc?.name} — {roomType?.type} • {inventory.beds_purchased} {t('beds') || 'أسرة'}
            </Text>
          </div>
        </Group>
        <Group>
          <Badge color="blue">{inventory.beds_sold} {t('occupied') || 'مشغولة'}</Badge>
          <Badge color="green">{inventory.beds_purchased - inventory.beds_sold} {t('available') || 'متاحة'}</Badge>
          <Text size="xs" c="dimmed">
            {formatLocalDate(inventory.check_in_date)} → {formatLocalDate(inventory.check_out_date)}
          </Text>
        </Group>
      </Group>

      <Card withBorder p="md">
        <Group>
          <Building2 size={24} color="#8B7355" />
          <div>
            <Text fw={600}>{acc?.name_ar || acc?.name}</Text>
            <Text size="xs" c="dimmed">{acc?.city} • {t(roomType?.type) || roomType?.type} ({beds_per_room} {t('beds_per_room') || 'أسرة/غرفة'})</Text>
          </div>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4, xl: 5 }} spacing="md">
        {roomsGrid.map((roomBeds, roomIdx) => {
          const savedLabel = inventory.room_labels?.[roomIdx];
          const displayLabel = savedLabel || `${t('room') || 'غرفة'} ${roomIdx + 1}`;
          const isEditing = editingRoom === roomIdx;
          return (
            <Card key={roomIdx} withBorder p="md" radius="md" style={{ backgroundColor: '#FEFBF6' }}>
              <Group justify="space-between" mb="sm" wrap="nowrap">
                {isEditing ? (
                  <Group gap={4} wrap="nowrap" style={{ flex: 1 }}>
                    <TextInput
                      size="xs"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveLabel(roomIdx);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      placeholder={`${t('room') || 'غرفة'} ${roomIdx + 1}`}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <ActionIcon size="sm" color="green" loading={savingLabel} onClick={() => saveLabel(roomIdx)}>
                      <Check size={14} />
                    </ActionIcon>
                    <ActionIcon size="sm" color="gray" onClick={cancelEditing}>
                      <X size={14} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <Group gap={4} wrap="nowrap">
                    <Badge size="lg" variant="light" color="brown">
                      {displayLabel}
                    </Badge>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => startEditing(roomIdx, savedLabel || '')}>
                      <Pencil size={12} />
                    </ActionIcon>
                  </Group>
                )}
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {roomBeds.filter((b) => b.used).length}/{roomBeds.length}
                </Text>
              </Group>
              <Group gap={8} wrap="wrap">
                {roomBeds.map((bed) => (
                  <BedSlot
                    key={bed.index}
                    bed={bed}
                    onNavigateToBooking={() => bed.booking_id && navigate(`/bookings/${bed.booking_id}`)}
                    t={t}
                  />
                ))}
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

function BedSlot({
  bed,
  onNavigateToBooking,
  t
}: {
  bed: BedMapData['beds'][0];
  onNavigateToBooking: () => void;
  t: (key: string) => string;
}) {
  const pilgrim = bed.pilgrim;
  const name = pilgrim ? (pilgrim.full_name_ar || pilgrim.full_name || '-') : (t('available') || 'متاح');
  const isClickable = bed.used && bed.booking_id;
  const genderColor = pilgrim?.gender === 'male' ? 'blue' : 'pink';

  return (
    <Tooltip label={bed.used ? `${name} • ${bed.booking_number || ''}` : (t('empty_bed') || 'سرير فارغ')} withArrow>
      <Box
        component={isClickable ? 'button' : 'div'}
        onClick={isClickable ? onNavigateToBooking : undefined}
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          border: bed.used ? `2px solid var(--mantine-color-${genderColor}-6)` : '2px dashed #ccc',
          backgroundColor: bed.used ? `var(--mantine-color-${genderColor}-0)` : '#f5f5f5',
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
        {bed.used && pilgrim ? (
          pilgrim.photo_url ? (
            <Avatar
              src={pilgrim.photo_url}
              size={40}
              radius="md"
              color={genderColor}
            >
              {name[0]}
            </Avatar>
          ) : (
            <ThemeIcon size={40} radius="md" color={genderColor} variant="light">
              <User size={24} />
            </ThemeIcon>
          )
        ) : (
          <BedDouble size={24} color="#999" />
        )}
      </Box>
    </Tooltip>
  );
}

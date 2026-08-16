import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Paper,
  Title,
  Button,
  Group,
  Table,
  Progress,
  Badge,
  Text,
  Modal,
  Select,
  SimpleGrid,
  Card,
  LoadingOverlay,
  ActionIcon,
  Stack,
  Tooltip
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { Plus, Edit, Trash2, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HotelInventoryForm } from './HotelInventoryForm';
import { useAuth } from '../../providers/AuthProvider';
import { formatLocalDate } from '../../lib/dates';

interface HotelInventory {
  id: string;
  // Support both bed-based (new) and room-based (old/view) field names
  beds_purchased?: number;
  beds_sold?: number;
  beds_available?: number;
  purchase_price_per_bed?: number;
  sell_price_per_bed?: number;
  margin_per_bed?: number;
  // Old field names (from view for compatibility)
  rooms_purchased?: number;
  rooms_sold?: number;
  rooms_available?: number;
  purchase_price_per_room?: number;
  sell_price_per_room?: number;
  margin_per_room?: number;
  // Common fields
  total_purchase_cost: number;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  accommodations?: { name: string; name_ar?: string; city: string; country?: string };
  room_types?: { type: string; total_beds: number };
  seasons?: { name: string };
}

export function HotelInventoryPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = role === 'agency_admin' || role === 'super_admin';
  const [inventory, setInventory] = useState<HotelInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<HotelInventory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<HotelInventory | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null);
  const [accommodationFilter, _setAccommodationFilter] = useState<string | null>(
    (location.state as any)?.accommodation_id || null
  );
  const [roomTypeFilter, _setRoomTypeFilter] = useState<string | null>(
    (location.state as any)?.room_type_id || null
  );
  const [seasons, setSeasons] = useState<any[]>([]);

  useEffect(() => {
    loadSeasons();
    fetchInventory();
  }, [seasonFilter, accommodationFilter, roomTypeFilter]);

  // Refetch when tab becomes visible (e.g. user returns after completing a booking elsewhere)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchInventory();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [seasonFilter, accommodationFilter, roomTypeFilter]);

  const loadSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data || []);
    } catch (error) {
      console.error('Error loading seasons:', error);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (seasonFilter) params.season_id = seasonFilter;
      if (accommodationFilter) params.accommodation_id = accommodationFilter;
      if (roomTypeFilter) params.room_type_id = roomTypeFilter;
      const data = await api.getHotelInventory(params);
      // If filters are set, filter client-side as well
      let filtered = data || [];
      if (accommodationFilter) {
        filtered = filtered.filter((inv: any) => inv.accommodation_id === accommodationFilter);
      }
      if (roomTypeFilter) {
        filtered = filtered.filter((inv: any) => inv.room_type_id === roomTypeFilter);
      }
      setInventory(filtered);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load inventory',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    setModalOpen(false);
    setEditingInventory(null);
    fetchInventory();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.deleteHotelInventory(deleteConfirm.id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('inventory_deleted') || 'Inventory deleted successfully',
        color: 'green'
      });
      setDeleteConfirm(null);
      fetchInventory();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to delete inventory',
        color: 'red'
      });
    }
  };

  // Support both bed-based and room-based fields for compatibility
  const totalPurchased = inventory.reduce((sum, inv) => sum + (inv.beds_purchased || inv.rooms_purchased || 0), 0);
  const totalSold = inventory.reduce((sum, inv) => sum + (inv.beds_sold || inv.rooms_sold || 0), 0);
  const totalAvailable = inventory.reduce((sum, inv) => sum + (inv.beds_available || inv.rooms_available || 0), 0);
  const totalPurchaseCost = inventory.reduce((sum, inv) => sum + Number(inv.total_purchase_cost || 0), 0);

  return (
    <Paper p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Group justify="space-between" mb="md">
        <Title order={3}>
          {t('hotel_room_inventory') || 'مخزون غرف الفنادق'}
        </Title>
        {isAdmin && (
          <Button leftSection={<Plus size={16} />} onClick={() => {
            setEditingInventory(null);
            setModalOpen(true);
          }}>
            {t('add_inventory') || 'إضافة مخزون'}
          </Button>
        )}
      </Group>

      <Group mb="md">
        <Select
          label={t('filter_by_season') || 'تصفية حسب الموسم'}
          value={seasonFilter || ''}
          onChange={(value) => setSeasonFilter(value || null)}
          data={[
            { value: '', label: t('all') || 'الكل' },
            ...seasons.map(s => ({ value: String(s.id || ''), label: s.name || '' }))
          ]}
          clearable
          style={{ width: 250 }}
        />
      </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('total_beds') || 'إجمالي الأسرة'}</Text>
          <Text fw={700} size="xl" c="blue">{totalPurchased}</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('beds_sold') || 'الأسرة المباعة'}</Text>
          <Text fw={700} size="xl" c="orange">{totalSold}</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('beds_available') || 'الأسرة المتاحة'}</Text>
          <Text fw={700} size="xl" c="green">{totalAvailable}</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('total_cost') || 'إجمالي التكلفة'}</Text>
          <Text fw={700} size="xl" c="#C99A3D">{totalPurchaseCost.toLocaleString()} MAD</Text>
        </Card>
      </SimpleGrid>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('accommodation') || 'السكن'}</Table.Th>
            <Table.Th>{t('room_type') || 'نوع الغرفة'}</Table.Th>
            <Table.Th>{t('dates') || 'التواريخ'}</Table.Th>
            <Table.Th>{t('beds_purchased') || 'أسرة مشتراة'}</Table.Th>
            <Table.Th>{t('beds_sold') || 'أسرة مباعة'}</Table.Th>
            <Table.Th>{t('beds_available') || 'أسرة متاحة'}</Table.Th>
            <Table.Th>{t('usage') || 'الاستخدام'}</Table.Th>
            <Table.Th>{t('prices') || 'الأسعار'}</Table.Th>
            <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {inventory.map((inv) => {
            const bedsPurchased = inv.beds_purchased || inv.rooms_purchased || 0;
            const bedsSold = inv.beds_sold || inv.rooms_sold || 0;
            const bedsAvailable = inv.beds_available || inv.rooms_available || 0;
            const purchasePrice = inv.purchase_price_per_bed || inv.purchase_price_per_room || 0;
            const sellPrice = inv.sell_price_per_bed || inv.sell_price_per_room;
            const margin = inv.margin_per_bed || inv.margin_per_room;
            const usagePercent = bedsPurchased 
              ? (bedsSold / bedsPurchased) * 100 
              : 0;
            
            return (
              <Table.Tr key={inv.id}>
                <Table.Td>
                  <Text fw={500}>{inv.accommodations?.name_ar || inv.accommodations?.name}</Text>
                  <Text size="xs" c="dimmed">{inv.accommodations?.city}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge>{inv.room_types?.type}</Badge>
                  <Text size="xs" c="dimmed">{inv.room_types?.total_beds} {t('beds') || 'أسرة'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatLocalDate(inv.check_in_date)}</Text>
                  <Text size="xs" c="dimmed">→ {formatLocalDate(inv.check_out_date)}</Text>
                  <Text size="xs" c="dimmed">({inv.nights} {t('nights') || 'ليلة'})</Text>
                </Table.Td>
                <Table.Td>{bedsPurchased}</Table.Td>
                <Table.Td>{bedsSold}</Table.Td>
                <Table.Td>
                  <Badge color={bedsAvailable > 0 ? 'green' : 'red'}>
                    {bedsAvailable}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <Text size="xs">{usagePercent.toFixed(1)}%</Text>
                    <Progress 
                      value={usagePercent}
                      size="sm"
                      color={usagePercent < 50 ? 'green' : usagePercent < 90 ? 'yellow' : 'red'}
                    />
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">{t('buy') || 'شراء'}: {Number(purchasePrice).toLocaleString()}</Text>
                  {sellPrice && (
                    <Text size="xs" c="dimmed">{t('sell') || 'بيع'}: {Number(sellPrice).toLocaleString()}</Text>
                  )}
                  {margin !== undefined && margin !== null && (
                    <Badge size="xs" color={Number(margin) >= 0 ? 'green' : 'red'}>
                      {Number(margin).toFixed(0)} MAD
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label={t('bed_map') || 'خريطة الأسرة'}>
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        onClick={() => navigate(`/inventory/hotel-rooms/${inv.id}/bed-map`)}
                      >
                        <LayoutGrid size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {isAdmin && (
                      <>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => {
                            setEditingInventory(inv);
                            setModalOpen(true);
                          }}
                        >
                          <Edit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteConfirm(inv)}
                          disabled={bedsSold > 0}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {/* Create/Edit Modal */}
      <Modal 
        opened={modalOpen} 
        onClose={() => {
          setModalOpen(false);
          setEditingInventory(null);
        }} 
        title={editingInventory ? t('edit_inventory') || 'تعديل المخزون' : t('add_inventory') || 'إضافة مخزون'}
        size="lg"
      >
        <HotelInventoryForm 
          inventory={editingInventory || undefined}
          onSave={handleSave}
          onCancel={() => {
            setModalOpen(false);
            setEditingInventory(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('confirm_delete') || 'تأكيد الحذف'}
        size="sm"
      >
        <Stack>
          <Text>
            {t('confirm_delete_inventory') || 'Are you sure you want to delete this inventory?'}
          </Text>
          {deleteConfirm && (deleteConfirm.beds_sold || deleteConfirm.rooms_sold || 0) > 0 && (
            <Text size="sm" c="red">
              {t('cannot_delete_sold_inventory') || 'Cannot delete inventory with sold beds'}
            </Text>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button color="red" onClick={handleDelete} disabled={(deleteConfirm?.beds_sold || deleteConfirm?.rooms_sold || 0) > 0}>
              {t('delete') || 'حذف'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

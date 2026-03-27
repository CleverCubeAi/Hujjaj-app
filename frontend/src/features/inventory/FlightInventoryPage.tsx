import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { FlightInventoryForm } from './FlightInventoryForm';
import { useAuth } from '../../providers/AuthProvider';

interface FlightInventory {
  id: string;
  seat_class?: string;
  seats_purchased: number;
  seats_sold: number;
  seats_available: number;
  purchase_price_per_seat: number;
  sell_price_per_seat: number;
  total_purchase_cost: number;
  margin_per_seat: number;
  flights?: { code: string; departure_city: string; arrival_city: string; departure_date: string; carrier: string };
  seasons?: { name: string };
}

export default function FlightInventoryPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = role === 'agency_admin' || role === 'super_admin';
  const [inventory, setInventory] = useState<FlightInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<FlightInventory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FlightInventory | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null);
  const [flightFilter, _setFlightFilter] = useState<string | null>(
    (location.state as any)?.flight_id || null
  );
  const [seasons, setSeasons] = useState<any[]>([]);

  useEffect(() => {
    loadSeasons();
    fetchInventory();
  }, [seasonFilter, flightFilter]);

  // Refetch when tab becomes visible (e.g. user returns after completing a booking elsewhere)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchInventory();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [seasonFilter, flightFilter]);

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
      const data = await api.getFlightInventory(params);
      // Filter by flight_id if provided
      let filtered = data || [];
      if (flightFilter) {
        filtered = filtered.filter((inv: any) => inv.flight_id === flightFilter);
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
      await api.deleteFlightInventory(deleteConfirm.id);
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

  const totalPurchased = inventory.reduce((sum, inv) => sum + inv.seats_purchased, 0);
  const totalSold = inventory.reduce((sum, inv) => sum + inv.seats_sold, 0);
  const totalAvailable = inventory.reduce((sum, inv) => sum + inv.seats_available, 0);
  const totalPurchaseCost = inventory.reduce((sum, inv) => sum + Number(inv.total_purchase_cost), 0);

  return (
    <Paper p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Group justify="space-between" mb="md">
        <Title order={3}>
          {t('flight_seat_inventory') || 'مخزون مقاعد الطائرات'}
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
          <Text size="xs" c="dimmed" tt="uppercase">{t('total_seats') || 'إجمالي المقاعد'}</Text>
          <Text fw={700} size="xl" c="blue">{totalPurchased}</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('seats_sold') || 'المقاعد المباعة'}</Text>
          <Text fw={700} size="xl" c="orange">{totalSold}</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('seats_available') || 'المقاعد المتاحة'}</Text>
          <Text fw={700} size="xl" c="green">{totalAvailable}</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('total_cost') || 'إجمالي التكلفة'}</Text>
          <Text fw={700} size="xl" c="brown">{totalPurchaseCost.toLocaleString()} MAD</Text>
        </Card>
      </SimpleGrid>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('flight') || 'الرحلة'}</Table.Th>
            <Table.Th>{t('departure_date') || 'تاريخ المغادرة'}</Table.Th>
            <Table.Th>{t('purchased') || 'مشتراة'}</Table.Th>
            <Table.Th>{t('sold') || 'مباعة'}</Table.Th>
            <Table.Th>{t('available') || 'متاحة'}</Table.Th>
            <Table.Th>{t('usage') || 'الاستخدام'}</Table.Th>
            <Table.Th>{t('prices') || 'الأسعار'}</Table.Th>
            <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {inventory.map((inv) => {
            const usagePercent = inv.seats_purchased 
              ? ((inv.seats_sold || 0) / inv.seats_purchased) * 100 
              : 0;
            
            return (
              <Table.Tr key={inv.id}>
                <Table.Td>
                  <Group gap="xs">
                    <Text fw={500}>{inv.flights?.code}</Text>
                    {inv.seat_class && inv.seat_class !== 'economy' && (
                      <Badge size="xs" variant="light">{t(inv.seat_class) || inv.seat_class}</Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {inv.flights?.departure_city} → {inv.flights?.arrival_city}
                  </Text>
                  <Text size="xs" c="dimmed">{inv.flights?.carrier}</Text>
                </Table.Td>
                <Table.Td>
                  {inv.flights?.departure_date && (
                    <Text size="sm">{new Date(inv.flights.departure_date).toLocaleDateString()}</Text>
                  )}
                </Table.Td>
                <Table.Td>{inv.seats_purchased}</Table.Td>
                <Table.Td>{inv.seats_sold || 0}</Table.Td>
                <Table.Td>
                  <Badge color={inv.seats_available > 0 ? 'green' : 'red'}>
                    {inv.seats_available}
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
                  <Text size="xs" c="dimmed">{t('buy') || 'شراء'}: {Number(inv.purchase_price_per_seat).toLocaleString()}</Text>
                  {inv.sell_price_per_seat && (
                    <Text size="xs" c="dimmed">{t('sell') || 'بيع'}: {Number(inv.sell_price_per_seat).toLocaleString()}</Text>
                  )}
                  {inv.margin_per_seat && (
                    <Badge size="xs" color={inv.margin_per_seat >= 0 ? 'green' : 'red'}>
                      {Number(inv.margin_per_seat).toFixed(0)} MAD
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label={t('seat_map') || 'خريطة المقاعد'}>
                      <ActionIcon
                        variant="subtle"
                        color="brown"
                        onClick={() => navigate(`/inventory/flight-seats/${inv.id}/seat-map`)}
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
                          disabled={inv.seats_sold > 0}
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
        size="xl"
      >
        <FlightInventoryForm 
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
          {deleteConfirm && deleteConfirm.seats_sold > 0 && (
            <Text size="sm" c="red">
              {t('cannot_delete_sold_inventory') || 'Cannot delete inventory with sold seats'}
            </Text>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button color="red" onClick={handleDelete} disabled={(deleteConfirm?.seats_sold ?? 0) > 0}>
              {t('delete') || 'حذف'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

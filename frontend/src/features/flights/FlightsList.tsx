import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Table, Title, Button, Group, Modal, TextInput, Stack, Paper, 
  Select, ActionIcon, Menu, Badge, LoadingOverlay, Text, Alert,
  Switch, Card, Divider, NumberInput, Collapse, Box, Tooltip, Image
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, MoreVertical, Plane, MapPin, Clock, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { ImageUpload } from '../../components/common/ImageUpload';

interface Season {
  id: string;
  name: string;
  type: string;
}

interface Transit {
  id?: string;
  stop_order: number;
  city: string;
  airport_code: string;
  arrival_time: string;
  departure_time: string;
  layover_minutes: number;
  carrier: string;
  flight_number: string;
  notes: string;
}

interface Flight {
  id: string;
  code: string;
  carrier: string;
  departure_city: string;
  arrival_city: string;
  departure_date: string;
  return_date: string;
  season_id: string;
  is_direct: boolean;
  total_duration_minutes: number;
  airline_logo_url?: string;
  seasons?: Season;
  flight_transits?: Transit[];
}

const emptyTransit: Transit = {
  stop_order: 1,
  city: '',
  airport_code: '',
  arrival_time: '',
  departure_time: '',
  layover_minutes: 0,
  carrier: '',
  flight_number: '',
  notes: ''
};

const initialForm = {
  code: '',
  carrier: '',
  departure_city: '',
  arrival_city: 'JED',
  departure_date: null as string | null,
  return_date: null as string | null,
  season_id: '',
  is_direct: true,
  total_duration_minutes: 0,
  airline_logo_url: null as string | null,
  transits: [] as Transit[]
};

export function FlightsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Flight | null>(null);
  const [expandedFlight, setExpandedFlight] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [inventoryData, setInventoryData] = useState<any[]>([]);

  const fetchFlights = async () => {
    setLoading(true);
    try {
      const data = await api.getFlights();
      setFlights(data || []);
    } catch (error) {
      console.error('Error fetching flights:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data || []);
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      const data = await api.getFlightInventory().catch(() => []);
      setInventoryData(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  useEffect(() => {
    fetchFlights();
    fetchSeasons();
    fetchInventory();
  }, []);

  const getFlightInventory = (flightId: string) => {
    const inv = inventoryData.filter((inv: any) => inv.flight_id === flightId);
    const totalPurchased = inv.reduce((sum: number, i: any) => sum + (i.seats_purchased || 0), 0);
    const totalSold = inv.reduce((sum: number, i: any) => sum + (i.seats_sold || 0), 0);
    const totalAvailable = inv.reduce((sum: number, i: any) => sum + (i.seats_available || 0), 0);
    return { seats_purchased: totalPurchased, seats_sold: totalSold, seats_available: totalAvailable };
  };

  const handleOpenCreate = () => {
    setForm(initialForm);
    setEditingFlight(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (flight: Flight) => {
    setForm({
      code: flight.code || '',
      carrier: flight.carrier || '',
      departure_city: flight.departure_city || '',
      arrival_city: flight.arrival_city || '',
      departure_date: flight.departure_date ? flight.departure_date : null,
      return_date: flight.return_date ? flight.return_date : null,
      season_id: flight.season_id || '',
      is_direct: flight.is_direct ?? true,
      total_duration_minutes: flight.total_duration_minutes || 0,
      airline_logo_url: flight.airline_logo_url || null,
      transits: flight.flight_transits?.map((t, i) => ({ ...t, stop_order: i + 1 })) || []
    });
    setEditingFlight(flight);
    setModalOpen(true);
  };

  const formatDateForApi = (date: Date | string | null | undefined): string => {
    if (date == null) return '';
    // String in YYYY-MM-DD form: pass through, never round-trip through Date (avoids TZ shift)
    if (typeof date === 'string') return date.slice(0, 10);
    if (date instanceof Date && !isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  // Normalize Mantine DateInput onChange value (string | Date | null) to YYYY-MM-DD string
  const toIsoDate = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    if (value instanceof Date && !isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const handleSave = async () => {
    try {
      const payload = {
        code: form.code.trim(),
        carrier: form.carrier.trim(),
        departure_city: form.departure_city.trim(),
        arrival_city: form.arrival_city.trim(),
        departure_date: formatDateForApi(form.departure_date),
        return_date: formatDateForApi(form.return_date),
        season_id: form.season_id || undefined,
        is_direct: form.is_direct,
        total_duration_minutes: form.total_duration_minutes || undefined,
        airline_logo_url: form.airline_logo_url,
        transits: form.is_direct ? [] : form.transits
      };

      if (editingFlight) {
        await api.updateFlight(editingFlight.id, payload);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('flight_updated') || 'تم تحديث الرحلة',
          color: 'green'
        });
      } else {
        await api.createFlight(payload);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('flight_created') || 'تم إضافة الرحلة',
          color: 'green'
        });
      }

      setModalOpen(false);
      setForm(initialForm);
      setEditingFlight(null);
      fetchFlights();
    } catch (error: any) {
      console.error('Error saving flight:', error);
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || t('error_saving') || 'خطأ في الحفظ',
        color: 'red'
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deleteFlight(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchFlights();
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('flight_deleted') || 'تم حذف الرحلة',
        color: 'green'
      });
    } catch (error: any) {
      console.error('Error deleting flight:', error);
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || t('error_deleting') || 'خطأ في الحذف',
        color: 'red'
      });
    }
  };

  const addTransit = () => {
    setForm({
      ...form,
      transits: [
        ...form.transits,
        { ...emptyTransit, stop_order: form.transits.length + 1 }
      ]
    });
  };

  const removeTransit = (index: number) => {
    const newTransits = form.transits.filter((_, i) => i !== index)
      .map((t, i) => ({ ...t, stop_order: i + 1 }));
    setForm({ ...form, transits: newTransits });
  };

  const updateTransit = (index: number, field: keyof Transit, value: any) => {
    const newTransits = [...form.transits];
    newTransits[index] = { ...newTransits[index], [field]: value };
    setForm({ ...form, transits: newTransits });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Avoid Date object (which parses YYYY-MM-DD as UTC and shifts in local TZ).
    // Split the ISO date string directly and format as DD/MM/YYYY.
    const datePart = dateStr.split('T')[0];
    const [y, m, d] = datePart.split('-');
    if (!y || !m || !d) return dateStr;
    return `${d}/${m}/${y}`;
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}${t('hour_short') || 'س'} ${mins}${t('min_short') || 'د'}`;
  };

  const toggleExpandFlight = (flightId: string) => {
    setExpandedFlight(expandedFlight === flightId ? null : flightId);
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('flights') || 'الرحلات'}</Title>
        <Button leftSection={<Plus size={16} />} onClick={handleOpenCreate}>
          {t('add_flight') || 'إضافة رحلة'}
        </Button>
      </Group>

      <Paper shadow="sm" p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 40 }}></Table.Th>
                        <Table.Th>{t('flight_code') || 'رمز الرحلة'}</Table.Th>
                        <Table.Th>{t('carrier') || 'الناقل'}</Table.Th>
                        <Table.Th>{t('route') || 'المسار'}</Table.Th>
                        <Table.Th>{t('type') || 'النوع'}</Table.Th>
                        <Table.Th>{t('departure_date') || 'تاريخ المغادرة'}</Table.Th>
                        <Table.Th>{t('season') || 'الموسم'}</Table.Th>
                        <Table.Th>{t('inventory_status') || 'Inventory'}</Table.Th>
                        <Table.Th>{t('actions') || 'إجراءات'}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
          <Table.Tbody>
            {flights.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text ta="center" c="dimmed" py="xl">
                    {t('no_flights') || 'لا توجد رحلات'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              flights.map((flight) => {
                const inventory = getFlightInventory(flight.id);
                return (
                  <React.Fragment key={flight.id}>
                    <Table.Tr>
                      <Table.Td>
                        {!flight.is_direct && flight.flight_transits && flight.flight_transits.length > 0 && (
                          <ActionIcon 
                            variant="subtle" 
                            size="sm"
                            onClick={() => toggleExpandFlight(flight.id)}
                          >
                            {expandedFlight === flight.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </ActionIcon>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Plane size={16} />
                          <Text fw={500}>{flight.code}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {flight.airline_logo_url ? (
                            <Image
                              src={flight.airline_logo_url}
                              w={24}
                              h={24}
                              fit="contain"
                              radius="sm"
                            />
                          ) : null}
                          {flight.carrier || '-'}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="teal">
                          {flight.departure_city} → {flight.arrival_city}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          variant="light" 
                          color={flight.is_direct ? 'green' : 'orange'}
                        >
                          {flight.is_direct ? (t('direct') || 'مباشر') : (t('indirect') || 'غير مباشر')}
                        </Badge>
                        {!flight.is_direct && flight.flight_transits && (
                          <Text size="xs" c="dimmed">
                            {flight.flight_transits.length} {t('stops') || 'توقفات'}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{formatDate(flight.departure_date)}</Table.Td>
                      <Table.Td>
                        {flight.seasons ? (
                          <Badge variant="light" color="teal">
                            {flight.seasons.name}
                          </Badge>
                        ) : '-'}
                      </Table.Td>
                      <Table.Td>
                        {inventory.seats_purchased > 0 ? (
                          <Tooltip label={`${t('purchased') || 'Purchased'}: ${inventory.seats_purchased} | ${t('sold') || 'Sold'}: ${inventory.seats_sold} | ${t('available') || 'Available'}: ${inventory.seats_available}`}>
                            <Group gap={4}>
                              <Badge size="sm" color="teal">{inventory.seats_purchased} {t('purchased') || 'P'}</Badge>
                              <Badge size="sm" color={inventory.seats_available > 0 ? 'green' : 'red'}>
                                {inventory.seats_available} {t('available') || 'A'}
                              </Badge>
                            </Group>
                          </Tooltip>
                        ) : (
                          <Text size="xs" c="dimmed">{t('no_inventory') || 'No inventory'}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <ActionIcon variant="subtle">
                              <MoreVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item 
                              leftSection={<Package size={14} />}
                              onClick={() => navigate('/inventory/flight-seats', { state: { flight_id: flight.id } })}
                            >
                              {t('view_inventory') || 'View Inventory'}
                            </Menu.Item>
                            <Menu.Item 
                              leftSection={<Edit size={14} />}
                              onClick={() => handleOpenEdit(flight)}
                            >
                              {t('edit') || 'تعديل'}
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item 
                              leftSection={<Trash2 size={14} />}
                              color="red"
                              onClick={() => setDeleteConfirm(flight)}
                            >
                              {t('delete') || 'حذف'}
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  {/* Expanded transit details */}
                  {expandedFlight === flight.id && flight.flight_transits && (
                    <Table.Tr>
                      <Table.Td colSpan={9} style={{ backgroundColor: '#f8f9fa', padding: 0 }}>
                        <Box p="md">
                          <Text fw={600} mb="sm">{t('transit_stops') || 'محطات التوقف'}:</Text>
                          <Stack gap="xs">
                            {flight.flight_transits.map((transit, idx) => (
                              <Card key={transit.id || idx} withBorder p="sm" radius="sm">
                                <Group justify="space-between">
                                  <Group gap="md">
                                    <Badge variant="filled" color="gray" size="sm">
                                      {t('stop') || 'توقف'} {idx + 1}
                                    </Badge>
                                    <Group gap="xs">
                                      <MapPin size={14} />
                                      <Text fw={500}>{transit.city}</Text>
                                      {transit.airport_code && (
                                        <Text c="dimmed" size="sm">({transit.airport_code})</Text>
                                      )}
                                    </Group>
                                  </Group>
                                  <Group gap="md">
                                    {transit.layover_minutes > 0 && (
                                      <Group gap={4}>
                                        <Clock size={14} />
                                        <Text size="sm">{formatDuration(transit.layover_minutes)}</Text>
                                      </Group>
                                    )}
                                    {transit.flight_number && (
                                      <Badge variant="light" size="sm">{transit.flight_number}</Badge>
                                    )}
                                  </Group>
                                </Group>
                              </Card>
                            ))}
                          </Stack>
                        </Box>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </React.Fragment>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create/Edit Modal */}
      <Modal 
        opened={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingFlight ? (t('edit_flight') || 'تعديل رحلة') : (t('add_flight') || 'إضافة رحلة')}
        size="lg"
      >
        <Stack>
          <Select
            label={t('season') || 'الموسم'}
            placeholder={t('select_season') || 'اختر الموسم'}
            data={seasons.map(s => ({ value: s.id, label: `${s.name} (${t(s.type) || s.type})` }))}
            value={form.season_id}
            onChange={(v) => setForm({ ...form, season_id: v || '' })}
            searchable
            clearable
          />
          
          <Group grow align="flex-end">
            <TextInput
              label={t('flight_code') || 'رمز الرحلة'}
              placeholder="AT-123"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.currentTarget.value })}
              required
            />
            <TextInput
              label={t('carrier') || 'الناقل'}
              placeholder={t('airline_name') || 'اسم شركة الطيران'}
              value={form.carrier}
              onChange={(e) => setForm({ ...form, carrier: e.currentTarget.value })}
            />
            <Box>
              <Text size="sm" fw={500} mb={4}>{t('airline_logo') || 'شعار الناقل'}</Text>
              <ImageUpload
                value={form.airline_logo_url}
                onChange={(url) => setForm({ ...form, airline_logo_url: url })}
                folder="airlines"
                size={60}
                placeholder={form.carrier}
              />
            </Box>
          </Group>

          <Group grow>
            <TextInput
              label={t('departure_city') || 'مدينة المغادرة'}
              placeholder="CMN"
              value={form.departure_city}
              onChange={(e) => setForm({ ...form, departure_city: e.currentTarget.value })}
              required
            />
            <TextInput
              label={t('arrival_city') || 'مدينة الوصول'}
              placeholder="JED"
              value={form.arrival_city}
              onChange={(e) => setForm({ ...form, arrival_city: e.currentTarget.value })}
              required
            />
          </Group>

          <Group grow>
            <DateInput
              label={t('departure_date') || 'تاريخ المغادرة'}
              placeholder={t('select_date') || 'اختر التاريخ'}
              value={form.departure_date}
              onChange={(value) => setForm({ ...form, departure_date: toIsoDate(value) })}
              valueFormat="YYYY-MM-DD"
              clearable
              required
              popoverProps={{ withinPortal: true }}
            />
            <DateInput
              label={t('return_date') || 'تاريخ العودة'}
              placeholder={t('select_date') || 'اختر التاريخ'}
              value={form.return_date}
              onChange={(value) => setForm({ ...form, return_date: toIsoDate(value) })}
              valueFormat="YYYY-MM-DD"
              clearable
              popoverProps={{ withinPortal: true }}
            />
          </Group>

          <Divider my="sm" />

          {/* Direct/Indirect Flight */}
          <Group justify="space-between">
            <div>
              <Text fw={500}>{t('flight_type') || 'نوع الرحلة'}</Text>
              <Text size="sm" c="dimmed">
                {form.is_direct 
                  ? (t('direct_flight_desc') || 'رحلة مباشرة بدون توقفات')
                  : (t('indirect_flight_desc') || 'رحلة مع توقفات في مدن أخرى')
                }
              </Text>
            </div>
            <Switch
              checked={!form.is_direct}
              onChange={(e) => setForm({ ...form, is_direct: !e.currentTarget.checked })}
              label={form.is_direct ? (t('direct') || 'مباشر') : (t('indirect') || 'غير مباشر')}
              labelPosition="left"
            />
          </Group>

          {!form.is_direct && (
            <NumberInput
              label={t('total_duration') || 'المدة الإجمالية (دقائق)'}
              placeholder="180"
              value={form.total_duration_minutes}
              onChange={(v) => setForm({ ...form, total_duration_minutes: Number(v) || 0 })}
              min={0}
            />
          )}

          {/* Transit Stops */}
          <Collapse in={!form.is_direct}>
            <Stack gap="md" mt="md">
              <Group justify="space-between">
                <Text fw={600}>{t('transit_stops') || 'محطات التوقف'}</Text>
                <Button 
                  size="xs" 
                  variant="light" 
                  leftSection={<Plus size={14} />}
                  onClick={addTransit}
                >
                  {t('add_stop') || 'إضافة توقف'}
                </Button>
              </Group>

              {form.transits.length === 0 && (
                <Alert color="gray">
                  {t('no_transits_yet') || 'لم يتم إضافة توقفات بعد. انقر على "إضافة توقف" لإضافة محطة.'}
                </Alert>
              )}

              {form.transits.map((transit, index) => (
                <Card key={index} withBorder p="md" radius="md">
                  <Group justify="space-between" mb="sm">
                    <Badge variant="filled" color="teal">
                      {t('stop') || 'توقف'} {index + 1}
                    </Badge>
                    <ActionIcon 
                      color="red" 
                      variant="subtle"
                      onClick={() => removeTransit(index)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>

                  <Stack gap="sm">
                    <Group grow>
                      <TextInput
                        label={t('city') || 'المدينة'}
                        placeholder={t('transit_city') || 'اسم المدينة'}
                        value={transit.city}
                        onChange={(e) => updateTransit(index, 'city', e.currentTarget.value)}
                        required
                      />
                      <TextInput
                        label={t('airport_code') || 'رمز المطار'}
                        placeholder="IST"
                        value={transit.airport_code}
                        onChange={(e) => updateTransit(index, 'airport_code', e.currentTarget.value)}
                      />
                    </Group>

                    <Group grow>
                      <TextInput
                        label={t('flight_number') || 'رقم الرحلة'}
                        placeholder="TK-123"
                        value={transit.flight_number}
                        onChange={(e) => updateTransit(index, 'flight_number', e.currentTarget.value)}
                      />
                      <TextInput
                        label={t('carrier') || 'الناقل'}
                        placeholder={t('if_different') || 'إذا كان مختلفاً'}
                        value={transit.carrier}
                        onChange={(e) => updateTransit(index, 'carrier', e.currentTarget.value)}
                      />
                    </Group>

                    <NumberInput
                      label={t('layover_duration') || 'مدة التوقف (دقائق)'}
                      placeholder="120"
                      value={transit.layover_minutes}
                      onChange={(v) => updateTransit(index, 'layover_minutes', Number(v) || 0)}
                      min={0}
                    />

                    <TextInput
                      label={t('notes') || 'ملاحظات'}
                      placeholder={t('transit_notes') || 'ملاحظات إضافية عن هذا التوقف'}
                      value={transit.notes}
                      onChange={(e) => updateTransit(index, 'notes', e.currentTarget.value)}
                    />
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Collapse>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button onClick={handleSave} disabled={!form.code || !form.departure_city || !form.arrival_city}>
              {editingFlight ? (t('save') || 'حفظ') : (t('add') || 'إضافة')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('confirm_delete') || 'تأكيد الحذف'}
        size="sm"
      >
        {deleteConfirm && (
          <Stack>
            <Alert color="red">
              {t('delete_flight_warning') || 'هل أنت متأكد من حذف هذه الرحلة؟'}
            </Alert>
            <Text fw={500} ta="center">
              {deleteConfirm.code} ({deleteConfirm.departure_city} → {deleteConfirm.arrival_city})
            </Text>
            <Group justify="center">
              <Button variant="default" onClick={() => setDeleteConfirm(null)}>
                {t('cancel') || 'إلغاء'}
              </Button>
              <Button color="red" onClick={handleDelete}>
                {t('delete') || 'حذف'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

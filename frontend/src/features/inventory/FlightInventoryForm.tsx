import { useEffect, useState } from 'react';
import {
  Stack,
  Select,
  TextInput,
  NumberInput,
  Button,
  Group,
  Divider,
  Text,
  Badge,
  Table,
  Paper
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';

const SEAT_CLASSES = ['economy', 'business', 'first_class'] as const;
type SeatClass = (typeof SEAT_CLASSES)[number];

interface FlightInventoryFormProps {
  inventory?: any;
  onSave: () => void;
  onCancel: () => void;
}

export function FlightInventoryForm({ inventory, onSave, onCancel }: FlightInventoryFormProps) {
  const { t } = useTranslation();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    season_id: '',
    flight_id: '',
    economy_seats: 0,
    business_seats: 0,
    first_class_seats: 0,
    economy_cost: 0,
    business_cost: 0,
    first_class_cost: 0,
    economy_sell: null as number | null,
    business_sell: null as number | null,
    first_class_sell: null as number | null,
    airline_reference: '',
    notes: ''
  });

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (inventory) {
      const cls = (inventory.seat_class || 'economy') as SeatClass;
      const seats = inventory.seats_purchased || 0;
      const price = inventory.purchase_price_per_seat || 0;
      const seatsByClass: Record<SeatClass, number> = { economy: 0, business: 0, first_class: 0 };
      seatsByClass[cls] = seats;
      const costByClass: Record<SeatClass, number> = { economy: 0, business: 0, first_class: 0 };
      costByClass[cls] = price;
      setForm({
        season_id: inventory.season_id || '',
        flight_id: inventory.flight_id || '',
        economy_seats: seatsByClass.economy,
        business_seats: seatsByClass.business,
        first_class_seats: seatsByClass.first_class,
        economy_cost: costByClass.economy,
        business_cost: costByClass.business,
        first_class_cost: costByClass.first_class,
        economy_sell: cls === 'economy' ? inventory.sell_price_per_seat : null,
        business_sell: cls === 'business' ? inventory.sell_price_per_seat : null,
        first_class_sell: cls === 'first_class' ? inventory.sell_price_per_seat : null,
        airline_reference: inventory.airline_reference || '',
        notes: inventory.notes || ''
      });
      if (inventory.season_id) loadFlights(inventory.season_id);
    }
  }, [inventory]);

  const loadSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data || []);
    } catch (error) {
      console.error('Error loading seasons:', error);
    }
  };

  const loadFlights = async (seasonId: string) => {
    try {
      const data = await api.getFlights(seasonId);
      setFlights(data || []);
    } catch (error) {
      console.error('Error loading flights:', error);
    }
  };

  const totalSeats = form.economy_seats + form.business_seats + form.first_class_seats;
  const totalPurchaseCost =
    form.economy_seats * form.economy_cost +
    form.business_seats * form.business_cost +
    form.first_class_seats * form.first_class_cost;

  const handleSubmit = async () => {
    if (!form.season_id || !form.flight_id) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('all_fields_required') || 'All required fields must be filled',
        color: 'red'
      });
      return;
    }
    if (totalSeats < 1) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('add_seats_per_class') || 'أدخل عدد المقاعد لفئة واحدة على الأقل',
        color: 'red'
      });
      return;
    }
    const costByClass = { economy: form.economy_cost, business: form.business_cost, first_class: form.first_class_cost };
    const seatsByClass = { economy: form.economy_seats, business: form.business_seats, first_class: form.first_class_seats };
    for (const cls of SEAT_CLASSES) {
      if (seatsByClass[cls] > 0 && costByClass[cls] <= 0) {
        notifications.show({
          title: t('error') || 'خطأ',
          message: `${t('cost_required_for_class') || 'سعر الشراء مطلوب'} (${classLabels[cls]})`,
          color: 'red'
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (inventory) {
        const cls = (inventory.seat_class || 'economy') as SeatClass;
        const seatsKey = `${cls}_seats` as 'economy_seats' | 'business_seats' | 'first_class_seats';
        const sellKey = `${cls}_sell` as 'economy_sell' | 'business_sell' | 'first_class_sell';
        const costKey = `${cls}_cost` as 'economy_cost' | 'business_cost' | 'first_class_cost';
        await api.updateFlightInventory(inventory.id, {
          season_id: form.season_id,
          flight_id: form.flight_id,
          seats_purchased: form[seatsKey] || inventory.seats_purchased,
          purchase_price_per_seat: form[costKey] ?? inventory.purchase_price_per_seat,
          sell_price_per_seat: form[sellKey] ?? null,
          seat_class: cls,
          airline_reference: form.airline_reference || null,
          notes: form.notes || null
        });
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('inventory_updated') || 'Inventory updated successfully',
          color: 'green'
        });
      } else {
        const basePayload = {
          season_id: form.season_id,
          flight_id: form.flight_id,
          airline_reference: form.airline_reference || null,
          notes: form.notes || null
        };
        const toCreate: { class: SeatClass; seats: number; cost: number; sell: number | null }[] = [];
        if (form.economy_seats > 0) toCreate.push({ class: 'economy', seats: form.economy_seats, cost: form.economy_cost, sell: form.economy_sell });
        if (form.business_seats > 0) toCreate.push({ class: 'business', seats: form.business_seats, cost: form.business_cost, sell: form.business_sell });
        if (form.first_class_seats > 0) toCreate.push({ class: 'first_class', seats: form.first_class_seats, cost: form.first_class_cost, sell: form.first_class_sell });
        for (const item of toCreate) {
          await api.createFlightInventory({
            ...basePayload,
            seats_purchased: item.seats,
            purchase_price_per_seat: item.cost,
            seat_class: item.class,
            sell_price_per_seat: item.sell ?? null
          });
        }
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('inventory_created') || 'Inventory created successfully',
          color: 'green'
        });
      }
      onSave();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to save inventory',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const classLabels: Record<SeatClass, string> = {
    economy: t('economy') || 'Economy',
    business: t('business') || 'Business',
    first_class: t('first_class') || 'First class'
  };

  return (
    <Stack gap="md">
      <Select
        label={t('season') || 'الموسم'}
        value={form.season_id || ''}
        onChange={(value) => {
          setForm({ ...form, season_id: value || '', flight_id: '' });
          if (value) loadFlights(value);
          else setFlights([]);
        }}
        data={seasons.map(s => ({ value: String(s.id || ''), label: s.name || '' }))}
        required
        searchable
      />

      <Select
        label={t('flight') || 'الرحلة'}
        value={form.flight_id || ''}
        onChange={(value) => setForm({ ...form, flight_id: value || '' })}
        data={flights.map(f => ({ 
          value: String(f.id || ''), 
          label: `${f.code || ''} - ${f.departure_city || ''} → ${f.arrival_city || ''} (${f.departure_date ? new Date(f.departure_date).toLocaleDateString() : ''})` 
        }))}
        required
        searchable
        disabled={!form.season_id || flights.length === 0}
        placeholder={!form.season_id ? (t('select_season_first') || 'اختر الموسم أولاً') : (flights.length === 0 ? (t('no_flights_for_season') || 'لا توجد رحلات لهذا الموسم') : (t('select_flight') || 'اختر الرحلة'))}
      />

      <Divider label={t('purchase_details') || 'تفاصيل الشراء'} />

      <Paper withBorder p="md" radius="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('category') || 'الفئة'}</Table.Th>
              <Table.Th>{t('seats_purchased') || 'عدد المقاعد'}</Table.Th>
              <Table.Th>{t('purchase_price_per_seat') || 'سعر الشراء'}</Table.Th>
              <Table.Th>{t('sell_price_per_seat') || 'سعر البيع'}</Table.Th>
              <Table.Th>{t('margin_per_seat') || 'الهامش'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(['economy', 'business', 'first_class'] as SeatClass[]).map((cls) => {
              const seats = form[`${cls}_seats` as keyof typeof form] as number;
              const cost = form[`${cls}_cost` as keyof typeof form] as number;
              const sell = form[`${cls}_sell` as keyof typeof form] as number | null;
              const disabled = !!inventory && inventory.seat_class !== cls;
              return (
                <Table.Tr key={cls}>
                  <Table.Td>
                    <Text fw={500}>{classLabels[cls]}</Text>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={seats}
                      onChange={(v) => setForm({ ...form, [`${cls}_seats`]: Number(v) || 0 })}
                      min={0}
                      disabled={disabled}
                      hideControls={inventory ? true : undefined}
                      size="xs"
                      w={90}
                    />
                  </Table.Td>
                  <Table.Td>
                    {seats > 0 ? (
                      <NumberInput
                        value={cost}
                        onChange={(v) => setForm({ ...form, [`${cls}_cost`]: Number(v) || 0 })}
                        min={0}
                        decimalScale={2}
                        disabled={disabled}
                        hideControls={inventory ? true : undefined}
                        size="xs"
                        w={100}
                        placeholder="MAD"
                      />
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {seats > 0 ? (
                      <NumberInput
                        value={sell ?? ''}
                        onChange={(v) => setForm({ ...form, [`${cls}_sell`]: v ? Number(v) : null })}
                        min={0}
                        decimalScale={2}
                        disabled={disabled}
                        hideControls={inventory ? true : undefined}
                        size="xs"
                        w={100}
                        placeholder={t('sell_price_description') || 'لاحقاً'}
                      />
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {seats > 0 && cost > 0 && sell != null && sell > 0 ? (
                      <Text size="sm" fw={500} c={sell >= cost ? 'green' : 'red'}>
                        {(sell - cost).toFixed(0)} MAD
                      </Text>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        {totalSeats > 0 && (
          <Group justify="space-between" mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="sm" fw={600}>
              {t('total_seats') || 'إجمالي المقاعد'}: <Badge size="lg">{totalSeats}</Badge>
            </Text>
            <Text size="sm" fw={600}>
              {t('total_purchase_cost') || 'إجمالي التكلفة'}: <Badge size="lg" color="blue">{totalPurchaseCost.toLocaleString()} MAD</Badge>
            </Text>
          </Group>
        )}
      </Paper>

      <TextInput
        label={t('airline_reference') || 'رقم حجز الطيران'}
        value={form.airline_reference}
        onChange={(e) => setForm({ ...form, airline_reference: e.currentTarget.value })}
      />

      <TextInput
        label={t('notes') || 'ملاحظات'}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
      />

      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={onCancel} disabled={loading}>
          {t('cancel') || 'إلغاء'}
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          {t('save') || 'حفظ'}
        </Button>
      </Group>
    </Stack>
  );
}

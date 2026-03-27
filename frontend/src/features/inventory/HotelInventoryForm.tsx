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
  RangeSlider
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';

interface HotelInventoryFormProps {
  inventory?: any;
  prefill?: { season_id?: string; accommodation_id?: string; room_type_id?: string };
  onSave: () => void;
  onCancel: () => void;
}

export function HotelInventoryForm({ inventory, prefill, onSave, onCancel }: HotelInventoryFormProps) {
  const { t } = useTranslation();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [accommodations, setAccommodations] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    season_id: '',
    accommodation_id: '',
    room_type_id: '',
    rooms_purchased: 0,
    total_purchase_cost: 0,
    check_in_date: null as Date | null,
    check_out_date: null as Date | null,
    sell_price_per_bed: null as number | null,
    supplier_type: '' as '' | 'hotel' | 'other',
    supplier_name: '',
    notes: ''
  });

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (form.season_id) {
      loadAccommodations(form.season_id);
    }
  }, [form.season_id]);

  useEffect(() => {
    if (form.accommodation_id) {
      loadRoomTypes(form.accommodation_id);
    }
  }, [form.accommodation_id]);

  useEffect(() => {
    if (inventory) {
      const beds = inventory.beds_purchased || inventory.rooms_purchased || 0;
      const pricePerBed = inventory.purchase_price_per_bed || inventory.purchase_price_per_room || 0;
      const rt = inventory.room_types || { total_beds: 2 };
      const bedsPerRoom = rt.total_beds || (rt.type === 'double' ? 2 : rt.type === 'triple' ? 3 : rt.type === 'quad' ? 4 : rt.type === 'quint' ? 5 : 2);
      const rooms = bedsPerRoom > 0 ? Math.round(beds / bedsPerRoom) : 0;
      setForm({
        season_id: inventory.season_id || '',
        accommodation_id: inventory.accommodation_id || '',
        room_type_id: inventory.room_type_id || '',
        rooms_purchased: rooms,
        total_purchase_cost: beds * pricePerBed,
        check_in_date: inventory.check_in_date 
          ? (inventory.check_in_date instanceof Date ? inventory.check_in_date : new Date(inventory.check_in_date))
          : null,
        check_out_date: inventory.check_out_date 
          ? (inventory.check_out_date instanceof Date ? inventory.check_out_date : new Date(inventory.check_out_date))
          : null,
        sell_price_per_bed: inventory.sell_price_per_bed || inventory.sell_price_per_room || null,
        supplier_type: (() => {
          const sn = (inventory.supplier_name || '').trim();
          return sn.toLowerCase() === 'hotel' ? 'hotel' : sn ? 'other' : '';
        })(),
        supplier_name: (() => {
          const sn = (inventory.supplier_name || '').trim();
          return sn.toLowerCase() === 'hotel' ? '' : sn;
        })(),
        notes: inventory.notes || ''
      });
    }
  }, [inventory]);

  useEffect(() => {
    if (prefill && !inventory) {
      setForm((prev) => ({
        ...prev,
        season_id: prefill.season_id || prev.season_id,
        accommodation_id: prefill.accommodation_id || prev.accommodation_id,
        room_type_id: prefill.room_type_id || prev.room_type_id,
      }));
    }
  }, [prefill, inventory]);

  // When season changes, default check-in/check-out to full season range
  useEffect(() => {
    const season = seasons.find((s: any) => String(s.id) === String(form.season_id));
    if (!season?.start_date || !season?.end_date) return;
    const start = new Date(season.start_date);
    const end = new Date(season.end_date);
    const needsReset = !form.check_in_date || !form.check_out_date ||
      form.check_in_date < start || form.check_out_date > end;
    if (needsReset) {
      setForm((prev) => ({ ...prev, check_in_date: start, check_out_date: end }));
    }
  }, [form.season_id, seasons]);

  const loadSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data || []);
    } catch (error) {
      console.error('Error loading seasons:', error);
    }
  };

  const loadAccommodations = async (seasonId: string) => {
    try {
      const data = await api.getAccommodations(seasonId);
      setAccommodations(data || []);
    } catch (error) {
      console.error('Error loading accommodations:', error);
    }
  };

  const loadRoomTypes = async (accommodationId: string) => {
    try {
      const data = await api.getAccommodationById(accommodationId);
      setRoomTypes(data?.room_types || []);
    } catch (error) {
      console.error('Error loading room types:', error);
    }
  };

  const getBedsPerRoom = (): number => {
    const rt = roomTypes.find((r: any) => String(r.id) === String(form.room_type_id));
    if (rt?.total_beds) return rt.total_beds;
    const type = rt?.type || '';
    const map: Record<string, number> = { double: 2, triple: 3, quad: 4, quint: 5 };
    return map[type] ?? 2;
  };

  const bedsPerRoom = getBedsPerRoom();
  const bedsPurchased = form.rooms_purchased * bedsPerRoom;
  const purchasePricePerBed = bedsPurchased > 0 ? form.total_purchase_cost / bedsPurchased : 0;

  const selectedSeason = seasons.find((s: any) => String(s.id) === String(form.season_id));
  const seasonStart = selectedSeason?.start_date ? new Date(selectedSeason.start_date) : null;
  const seasonEnd = selectedSeason?.end_date ? new Date(selectedSeason.end_date) : null;
  const totalDays = seasonStart && seasonEnd
    ? Math.max(1, Math.ceil((seasonEnd.getTime() - seasonStart.getTime()) / (24 * 60 * 60 * 1000)) + 1)
    : 0;

  const addDays = (date: Date, days: number) =>
    new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

  const dateToDayIndex = (date: Date | null): number => {
    if (!seasonStart || !date) return 0;
    return Math.round((date.getTime() - seasonStart.getTime()) / (24 * 60 * 60 * 1000));
  };

  const dayIndexToDate = (index: number): Date =>
    seasonStart ? addDays(seasonStart, index) : new Date();

  const dayRangeValue: [number, number] = seasonStart && form.check_in_date && form.check_out_date
    ? [
        Math.max(0, Math.min(dateToDayIndex(form.check_in_date), totalDays - 1)),
        Math.max(0, Math.min(dateToDayIndex(form.check_out_date), totalDays - 1)),
      ]
    : [0, Math.max(0, totalDays - 1)];

  const handleDayRangeChange = (value: [number, number]) => {
    const [startIdx, endIdx] = value;
    const start = Math.min(startIdx, endIdx);
    const end = Math.max(startIdx, endIdx);
    setForm({
      ...form,
      check_in_date: dayIndexToDate(start),
      check_out_date: dayIndexToDate(end),
    });
  };

  const handleSubmit = async () => {
    if (!form.season_id || !form.accommodation_id || !form.room_type_id || 
        !form.rooms_purchased || !form.total_purchase_cost || 
        !form.check_in_date || !form.check_out_date) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('all_fields_required') || 'All required fields must be filled',
        color: 'red'
      });
      return;
    }

    if (form.check_out_date && form.check_in_date && form.check_out_date <= form.check_in_date) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('check_out_after_check_in') || 'Check-out date must be after check-in date',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const checkInDate = form.check_in_date instanceof Date 
        ? form.check_in_date 
        : new Date(form.check_in_date as any);
      const checkOutDate = form.check_out_date instanceof Date 
        ? form.check_out_date 
        : new Date(form.check_out_date as any);

      const payload: any = {
        season_id: form.season_id,
        accommodation_id: form.accommodation_id,
        room_type_id: form.room_type_id,
        beds_purchased: bedsPurchased,
        purchase_price_per_bed: Math.round(purchasePricePerBed * 100) / 100,
        check_in_date: checkInDate.toISOString().split('T')[0],
        check_out_date: checkOutDate.toISOString().split('T')[0],
        sell_price_per_bed: form.sell_price_per_bed || null,
        supplier_name: form.supplier_type === 'hotel' ? 'Hotel' : (form.supplier_type === 'other' ? form.supplier_name || null : null),
        notes: form.notes || null
      };

      if (inventory) {
        await api.updateHotelInventory(inventory.id, payload);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('inventory_updated') || 'Inventory updated successfully',
          color: 'green'
        });
      } else {
        await api.createHotelInventory(payload);
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

  const nights = form.check_in_date && form.check_out_date && 
                 form.check_in_date instanceof Date && form.check_out_date instanceof Date
    ? Math.max(0, Math.ceil((form.check_out_date.getTime() - form.check_in_date.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const costPerBedPerNight = nights > 0 && purchasePricePerBed > 0 ? purchasePricePerBed / nights : 0;
  const margin = form.sell_price_per_bed ? form.sell_price_per_bed - purchasePricePerBed : 0;

  return (
    <Stack gap="md">
      <Select
        label={t('season') || 'الموسم'}
        value={form.season_id}
        onChange={(value) => setForm({ ...form, season_id: value || '', accommodation_id: '', room_type_id: '' })}
        data={seasons.map(s => ({ value: String(s.id || ''), label: s.name || '' }))}
        required
        searchable
      />

      <Select
        label={t('accommodation') || 'السكن'}
        value={form.accommodation_id}
        onChange={(value) => setForm({ ...form, accommodation_id: value || '', room_type_id: '' })}
        data={accommodations.map(a => ({ 
          value: String(a.id || ''), 
          label: `${a.name_ar || a.name} - ${a.city || ''}` 
        }))}
        required
        searchable
        disabled={!form.season_id}
      />

      <Select
        label={t('room_type') || 'نوع الغرفة'}
        value={form.room_type_id}
        onChange={(value) => setForm({ ...form, room_type_id: value || '' })}
        data={roomTypes.map(rt => ({ 
          value: String(rt.id || ''), 
          label: `${rt.type || ''} (${rt.total_beds || 0} ${t('beds') || 'أسرة'})` 
        }))}
        required
        disabled={!form.accommodation_id}
      />

      <Divider label={t('purchase_details') || 'تفاصيل الشراء'} />

      <NumberInput
        label={t('rooms_purchased') || 'عدد الغرف المشتراة'}
        value={form.rooms_purchased}
        onChange={(value) => setForm({ ...form, rooms_purchased: Number(value) || 0 })}
        required
        min={1}
      />

      {form.season_id && totalDays > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {`${t('check_in_date') || 'تاريخ الوصول'} – ${t('check_out_date') || 'تاريخ المغادرة'}`}
          </Text>
          <RangeSlider
            min={0}
            max={totalDays - 1}
            value={dayRangeValue}
            onChange={handleDayRangeChange}
            minRange={1}
            step={1}
            label={(v) => {
              const d = dayIndexToDate(v);
              return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            }}
          />
          {form.check_in_date && form.check_out_date && (
            <Text size="sm" c="dimmed">
              {form.check_in_date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              {' → '}
              {form.check_out_date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          )}
        </Stack>
      )}

      <NumberInput
        label={t('total_purchase_cost') || 'إجمالي تكلفة الشراء (MAD)'}
        description={t('total_purchase_cost_period_desc') || 'إجمالي المبلغ للفترة المختارة أعلاه بالكامل'}
        value={form.total_purchase_cost}
        onChange={(value) => setForm({ ...form, total_purchase_cost: Number(value) || 0 })}
        required
        min={0}
        decimalScale={2}
      />

      {bedsPurchased > 0 && (
        <Group gap="md">
          <Text size="sm" c="dimmed">
            {t('beds_purchased') || 'عدد الأسرة'}: <Badge size="lg">{bedsPurchased}</Badge>
            ({form.rooms_purchased} {t('rooms') || 'غرف'} × {bedsPerRoom} {t('beds') || 'أسرة'})
          </Text>
          <Text size="sm" c="dimmed">
            {t('purchase_price_per_bed_whole_stay') || 'سعر السرير للمدة كاملة'}: <Badge size="lg" color="blue">{purchasePricePerBed.toFixed(2)} MAD</Badge>
          </Text>
        </Group>
      )}

      {nights > 0 && (
        <Group>
          <Text size="sm" c="dimmed">{t('nights') || 'الليالي'}:</Text>
          <Badge size="lg">{nights}</Badge>
          <Text size="sm" c="dimmed">{t('cost_per_bed_per_night') || 'التكلفة لكل سرير/ليلة'}:</Text>
          <Badge size="lg" color="blue">{costPerBedPerNight.toFixed(2)} MAD</Badge>
        </Group>
      )}

      <Divider label={t('selling_details') || 'تفاصيل البيع'} />

      <NumberInput
        label={t('sell_price_per_bed') || 'سعر البيع لكل سرير (MAD)'}
        description={t('sell_price_description') || 'يمكن تعيينه لاحقاً'}
        value={form.sell_price_per_bed || ''}
        onChange={(value) => setForm({ ...form, sell_price_per_bed: value ? Number(value) : null })}
        min={0}
        decimalScale={2}
      />

      {form.sell_price_per_bed && (
        <Group>
          <Text size="sm" c="dimmed">{t('margin_per_bed') || 'الهامش لكل سرير'}:</Text>
          <Badge size="lg" color={margin >= 0 ? 'green' : 'red'}>
            {margin.toFixed(2)} MAD
          </Badge>
        </Group>
      )}

      <Select
        label={t('resource') || 'المورد'}
        placeholder={t('select') || 'اختر'}
        value={form.supplier_type}
        onChange={(value) => setForm({ ...form, supplier_type: (value as '' | 'hotel' | 'other') || '', supplier_name: value === 'other' ? form.supplier_name : '' })}
        data={[
          { value: 'hotel', label: t('hotel') || 'Hotel' },
          { value: 'other', label: t('other') || 'أخرى' },
        ]}
      />
      {form.supplier_type === 'other' && (
        <TextInput
          label={t('supplier_name_placeholder') || 'اسم المورد'}
          placeholder={t('supplier_name_placeholder') || 'اسم المورد'}
          value={form.supplier_name}
          onChange={(e) => setForm({ ...form, supplier_name: e.currentTarget.value })}
        />
      )}

      <TextInput
        label={t('notes') || 'ملاحظات'}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
      />

      <Divider />

      <Group>
        <Text size="sm" c="dimmed">{t('total_purchase_cost') || 'إجمالي تكلفة الشراء'}:</Text>
        <Badge size="lg" color="blue">{form.total_purchase_cost.toLocaleString()} MAD</Badge>
      </Group>

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

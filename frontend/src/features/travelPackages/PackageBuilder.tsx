import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Paper, Title, Button, Group, Text, Select, TextInput, NumberInput, Stack, Card, Badge,
  SimpleGrid, LoadingOverlay, ActionIcon, Alert, Box,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { Plane, Building2, Plus, X, GripVertical } from 'lucide-react';
import { api } from '../../lib/api';
import { formatLocalDate } from '../../lib/dates';

type Kind = 'flight' | 'hotel' | 'service';

const mad = (n: number) => `${Number(n || 0).toLocaleString('en')} د.م`;

function dragPayload(kind: Kind, id: string) {
  return `${kind}:${id}`;
}

export function PackageBuilder() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [status, setStatus] = useState('draft');
  const [catalog, setCatalog] = useState<{ flights: any[]; hotels: any[]; services: any[] }>({ flights: [], hotels: [], services: [] });
  const [flightId, setFlightId] = useState<string | null>(null);
  const [hotelIds, setHotelIds] = useState<string[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [sellingPrice, setSellingPrice] = useState<number | string>(0);
  const [priceTouched, setPriceTouched] = useState(false);
  const [dragging, setDragging] = useState<Kind | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogTab, setCatalogTab] = useState<Kind>('flight');

  useEffect(() => {
    api.getSeasons().then((rows: any) => setSeasons(rows || [])).catch(() => setSeasons([]));
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    api.getTravelPackage(id).then((pkg: any) => {
      setName(pkg.name || '');
      setNameAr(pkg.name_ar || '');
      setSeasonId(pkg.season_id);
      setStatus(pkg.status || 'draft');
      setFlightId(pkg.flight_seat_inventory_id);
      setHotelIds((pkg.hotels || []).map((h: any) => h.hotel_bed_inventory_id));
      setServiceIds((pkg.services || []).map((s: any) => s.extra_service_id));
      setSellingPrice(Number(pkg.selling_price || 0));
      setPriceTouched(true);
    }).catch((error: any) => {
      notifications.show({ color: 'red', message: error.message });
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!seasonId) {
      setCatalog({ flights: [], hotels: [], services: [] });
      setCatalogLoaded(false);
      return;
    }
    setCatalogLoaded(false);
    api.getTravelPackageCatalog(seasonId)
      .then((data: any) => setCatalog({
        flights: data?.flights || [],
        hotels: data?.hotels || [],
        services: data?.services || [],
      }))
      .catch(() => setCatalog({ flights: [], hotels: [], services: [] }))
      .finally(() => setCatalogLoaded(true));
  }, [seasonId]);

  const flight = catalog.flights.find((f) => f.id === flightId) || null;
  const hotels = hotelIds.map((hid) => catalog.hotels.find((h) => h.id === hid)).filter(Boolean);
  const services = serviceIds.map((sid) => catalog.services.find((s) => s.id === sid)).filter(Boolean);

  const calculated = useMemo(() => {
    const flightSell = flight ? Number(flight.sell_price_per_seat || 0) : 0;
    const hotelSell = hotels.reduce((sum, h) => sum + Number(h.sell_price_per_bed || 0), 0);
    const serviceSell = services.reduce((sum, s) => sum + Number(s.price || 0), 0);
    return Math.round((flightSell + hotelSell + serviceSell) * 100) / 100;
  }, [flight, hotels, services]);

  const cost = useMemo(() => {
    const flightCost = flight ? Number(flight.purchase_price_per_seat || 0) : 0;
    const hotelCost = hotels.reduce((sum, h) => sum + Number(h.purchase_price_per_bed || 0), 0);
    return Math.round((flightCost + hotelCost) * 100) / 100;
  }, [flight, hotels]);

  useEffect(() => {
    if (!priceTouched) setSellingPrice(calculated);
  }, [calculated, priceTouched]);

  const selling = catalogLoaded ? Math.min(Number(sellingPrice) || 0, calculated) : Number(sellingPrice) || 0;
  const saving = Math.max(0, Math.round((calculated - selling) * 100) / 100);
  const margin = Math.round((selling - cost) * 100) / 100;
  const belowCost = selling < cost && (flight || hotels.length > 0);
  const canPublish = !!name.trim() && !!seasonId && !!flight && hotels.length > 0 && selling <= calculated && selling >= 0;

  const add = (kind: Kind, itemId: string) => {
    if (kind === 'flight') setFlightId(itemId);
    if (kind === 'hotel' && !hotelIds.includes(itemId)) setHotelIds((prev) => [...prev, itemId]);
    if (kind === 'service' && !serviceIds.includes(itemId)) setServiceIds((prev) => [...prev, itemId]);
  };

  const onDrop = (event: React.DragEvent, slot: Kind) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    const [kind, itemId] = raw.split(':');
    if (kind === slot && itemId) add(slot, itemId);
    setDragging(null);
  };

  const payload = () => ({
    name: name.trim(),
    name_ar: nameAr.trim() || null,
    season_id: seasonId,
    selling_price: selling,
    components: [
      ...(flightId ? [{ component_type: 'flight', flight_seat_inventory_id: flightId }] : []),
      ...hotelIds.map((hid) => ({ component_type: 'hotel', hotel_bed_inventory_id: hid })),
      ...serviceIds.map((sid) => ({ component_type: 'service', extra_service_id: sid })),
    ],
  });

  const save = async (publish: boolean) => {
    if (!name.trim() || !seasonId) {
      notifications.show({ color: 'orange', message: t('fill_required_fields') || 'يرجى تعبئة الحقول المطلوبة' });
      return;
    }
    setBusy(true);
    try {
      const body = payload();
      const saved = isNew
        ? await api.createTravelPackage(body)
        : await api.updateTravelPackage(id as string, body);
      if (publish) {
        await api.publishTravelPackage(saved.id);
        notifications.show({ color: 'teal', message: t('published') || 'منشورة' });
      }
      navigate('/travel-packages');
    } catch (error: any) {
      notifications.show({ color: 'red', message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const slotStyle = (kind: Kind) => ({
    border: `2px dashed ${dragging === kind ? '#0C7774' : '#E2D9C8'}`,
    backgroundColor: dragging === kind ? '#E7F3F2' : '#fff',
    borderRadius: 12,
    padding: 12,
    minHeight: 88,
  });

  const catalogItems = catalogTab === 'flight' ? catalog.flights : catalogTab === 'hotel' ? catalog.hotels : catalog.services;

  return (
    <Paper p="xl" radius="lg" pos="relative" style={{ backgroundColor: '#F8F6F0', border: '1px solid #E2D9C8' }}>
      <LoadingOverlay visible={loading || busy} />
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('package_builder') || 'منشئ الباقة'}</Title>
        <Badge variant="light">{t(status) || status}</Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
        <TextInput
          label={t('package_name') || 'اسم الباقة'}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label={t('name_ar') || 'الاسم بالعربية'}
          value={nameAr}
          onChange={(e) => setNameAr(e.currentTarget.value)}
        />
      </SimpleGrid>
      <Select
        label={t('season') || 'الموسم'}
        data={seasons.map((s) => ({ value: s.id, label: `${s.name} (${s.type || ''})` }))}
        value={seasonId}
        onChange={(value) => {
          setSeasonId(value);
          setFlightId(null);
          setHotelIds([]);
          setServiceIds([]);
          setPriceTouched(false);
        }}
        mb="lg"
        required
        disabled={!isNew && status === 'published'}
      />

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <Stack>
          <Text fw={600}>{t('package_catalog') || 'المكوّنات'}</Text>
          <Group gap="xs">
            {(['flight', 'hotel', 'service'] as Kind[]).map((kind) => (
              <Button
                key={kind}
                size="xs"
                variant={catalogTab === kind ? 'filled' : 'light'}
                onClick={() => setCatalogTab(kind)}
              >
                {kind === 'flight' ? (t('flight') || 'الرحلة') : kind === 'hotel' ? (t('accommodation') || 'السكن') : (t('extra_services') || 'الخدمات')}
              </Button>
            ))}
          </Group>
          <Stack gap="xs">
            {catalogItems.map((item) => {
              const kind = catalogTab;
              const itemId = item.id as string;
              const taken = kind === 'flight' ? flightId === itemId : kind === 'hotel' ? hotelIds.includes(itemId) : serviceIds.includes(itemId);
              const title = kind === 'flight'
                ? `${item.code || ''} ${item.departure_city || ''} → ${item.arrival_city || ''}`
                : kind === 'hotel'
                  ? (item.accommodation_name_ar || item.accommodation_name)
                  : (item.name_ar || item.name);
              const price = kind === 'flight' ? item.sell_price_per_seat : kind === 'hotel' ? item.sell_price_per_bed : item.price;
              const stock = kind === 'flight' ? item.seats_available : kind === 'hotel' ? item.beds_available : null;
              return (
                <Card
                  key={itemId}
                  withBorder
                  padding="sm"
                  radius="md"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', dragPayload(kind, itemId));
                    e.dataTransfer.effectAllowed = 'copy';
                    setDragging(kind);
                  }}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => add(kind, itemId)}
                  style={{ cursor: 'grab', opacity: taken ? 0.55 : 1, background: taken ? '#E7F3F2' : '#fff' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <GripVertical size={14} color="#5C6B73" />
                      <div>
                        <Text size="sm" fw={600}>{title}</Text>
                        <Text size="xs" c="dimmed">
                          {kind === 'flight' && formatLocalDate(item.departure_date)}
                          {kind === 'hotel' && `${t(item.room_type) || item.room_type} · ${formatLocalDate(item.check_in_date)}`}
                          {kind === 'service' && (item.category || '')}
                          {stock != null ? ` · ${stock}` : ''}
                        </Text>
                      </div>
                    </Group>
                    <Text size="sm" fw={700} c="#C99A3D">{mad(price)}</Text>
                  </Group>
                </Card>
              );
            })}
            {seasonId && catalogItems.length === 0 && (
              <Text size="sm" c="dimmed">{t('no_data') || 'لا توجد بيانات'}</Text>
            )}
          </Stack>
        </Stack>

        <Stack>
          <Text fw={600}>{t('travel_package') || 'الباقة'}</Text>
          <Box
            style={slotStyle('flight')}
            onDragOver={(e) => { if (dragging === 'flight') e.preventDefault(); }}
            onDrop={(e) => onDrop(e, 'flight')}
          >
            <Group gap={6} mb={6}>
              <Plane size={14} />
              <Text size="sm" fw={600}>{t('flight') || 'الرحلة'}</Text>
            </Group>
            {flight ? (
              <Card withBorder padding="xs" radius="md">
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={600}>{flight.code}</Text>
                    <Text size="xs" c="dimmed">{flight.departure_city} → {flight.arrival_city}</Text>
                  </div>
                  <Group gap={4}>
                    <Text size="sm" c="#C99A3D">{mad(flight.sell_price_per_seat)}</Text>
                    <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setFlightId(null)}><X size={14} /></ActionIcon>
                  </Group>
                </Group>
              </Card>
            ) : (
              <Text size="xs" c="dimmed">{t('drop_flight') || 'أسقط الرحلة هنا'}</Text>
            )}
          </Box>

          <Box
            style={slotStyle('hotel')}
            onDragOver={(e) => { if (dragging === 'hotel') e.preventDefault(); }}
            onDrop={(e) => onDrop(e, 'hotel')}
          >
            <Group gap={6} mb={6}>
              <Building2 size={14} />
              <Text size="sm" fw={600}>{t('accommodation') || 'السكن'}</Text>
            </Group>
            <Stack gap={6}>
              {hotels.map((h) => (
                <Card key={h.id} withBorder padding="xs" radius="md">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={600}>{h.accommodation_name_ar || h.accommodation_name}</Text>
                      <Text size="xs" c="dimmed">{t(h.room_type) || h.room_type} · {h.city || ''}</Text>
                    </div>
                    <Group gap={4}>
                      <Text size="sm" c="#C99A3D">{mad(h.sell_price_per_bed)}</Text>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setHotelIds((prev) => prev.filter((x) => x !== h.id))}><X size={14} /></ActionIcon>
                    </Group>
                  </Group>
                </Card>
              ))}
              {hotels.length === 0 && <Text size="xs" c="dimmed">{t('drop_hotels') || 'أسقط الفنادق هنا'}</Text>}
            </Stack>
          </Box>

          <Box
            style={slotStyle('service')}
            onDragOver={(e) => { if (dragging === 'service') e.preventDefault(); }}
            onDrop={(e) => onDrop(e, 'service')}
          >
            <Group gap={6} mb={6}>
              <Plus size={14} />
              <Text size="sm" fw={600}>{t('extra_services') || 'الخدمات'}</Text>
            </Group>
            <Stack gap={6}>
              {services.map((s) => (
                <Card key={s.id} withBorder padding="xs" radius="md">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>{s.name_ar || s.name}</Text>
                    <Group gap={4}>
                      <Text size="sm" c="#C99A3D">{mad(s.price)}</Text>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setServiceIds((prev) => prev.filter((x) => x !== s.id))}><X size={14} /></ActionIcon>
                    </Group>
                  </Group>
                </Card>
              ))}
              {services.length === 0 && <Text size="xs" c="dimmed">{t('drop_services') || 'أسقط الخدمات هنا'}</Text>}
            </Stack>
          </Box>
        </Stack>

        <Paper withBorder p="md" radius="md" style={{ position: 'sticky', top: 16, background: '#fff', alignSelf: 'start' }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{t('separate_total') || 'السعر منفصلاً'}</Text>
              <Text fw={700}>{mad(calculated)}</Text>
            </Group>
            <NumberInput
              label={t('package_price') || 'سعر الباقة'}
              value={sellingPrice}
              min={0}
              max={calculated}
              onChange={(value) => {
                setPriceTouched(true);
                setSellingPrice(value);
              }}
            />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{t('bundle_saving') || 'التوفير'}</Text>
              <Text fw={700} c="teal">{mad(saving)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{t('cost') || 'التكلفة'}</Text>
              <Text>{mad(cost)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{t('margin') || 'الهامش'}</Text>
              <Text c={margin < 0 ? 'red' : undefined}>{mad(margin)}</Text>
            </Group>
            {belowCost && (
              <Alert color="orange" p="xs">
                <Text size="xs">{t('package_below_cost') || 'سعر الباقة أقل من التكلفة'}</Text>
              </Alert>
            )}
            <Button variant="default" onClick={() => save(false)} disabled={status === 'archived' || !catalogLoaded}>
              {t('save') || 'حفظ'}
            </Button>
            <Button onClick={() => save(true)} disabled={!canPublish || status === 'archived' || !catalogLoaded}>
              {t('publish_package') || 'نشر الباقة'}
            </Button>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Paper>
  );
}

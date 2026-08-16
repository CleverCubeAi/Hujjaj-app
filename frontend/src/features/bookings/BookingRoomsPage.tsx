import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Card,
  SimpleGrid,
  LoadingOverlay,
  Alert,
  Tabs,
  Accordion,
  Code
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { ArrowRight, BedDouble, Building2, Users, Wand2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { RoomMap } from './RoomMap';

interface Pilgrim {
  id: string;
  full_name: string;
  full_name_ar?: string;
  gender: 'male' | 'female';
  mahram_group_id?: string;
  spouse_id?: string;
  is_mahram?: boolean;
  hotel_inventory_ids?: string[];
  room_type_id?: string;
  accommodation_id?: string;
}

interface RoomAssignment {
  id: string;
  room_number: string;
  pilgrim_id: string;
  accommodation_id?: string;
  room_type_id?: string;
  pilgrims?: Pilgrim;
  accommodations?: { id: string; name: string; name_ar?: string; city?: string };
}

interface BookingRooms {
  booking: {
    id: string;
    booking_number: string;
    room_type_id?: string;
    accommodation_id?: string;
    hotel_inventory_ids?: string[];
    same_selection_for_all?: boolean;
    room_types?: {
      id: string;
      type: string;
      total_rooms: number;
      total_beds: number;
    };
    accommodations?: {
      id: string;
      name: string;
      name_ar?: string;
      city?: string;
    };
  };
  pilgrims: Pilgrim[];
  assignments: RoomAssignment[];
  hotels?: Array<{
    accommodation: { id: string; name: string; name_ar?: string; city?: string };
    room_type: { id: string; type: string; total_beds: number };
    accommodation_id: string;
    room_type_id: string;
    pilgrim_ids?: string[];
  }>;
}

export function BookingRoomsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<BookingRooms | null>(null);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  
  const [selectedHotelIndex, setSelectedHotelIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [bookingData, assignmentsResponse, hotelsData] = await Promise.all([
        api.getBookingById(id!),
        api.getBookingRoomAssignments(id!),
        api.getBookingHotels(id!).catch(() => [])
      ]);
      
      const assignmentsData = assignmentsResponse?.assignments || assignmentsResponse || [];
      
      setData({
        booking: bookingData,
        pilgrims: bookingData.pilgrims || [],
        assignments: Array.isArray(assignmentsData) ? assignmentsData : [],
        hotels: Array.isArray(hotelsData) ? hotelsData : []
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAllocate = async () => {
    setAllocating(true);
    try {
      const result = await api.allocateRooms(id!, {
        separateGenders: true,
        allowMahram: true,
        preferFamilyGroups: true
      });
      
      console.log('Allocation result:', result);
      
      if (result.warnings && result.warnings.length > 0) {
        alert(t('allocation_warnings') + ':\n' + result.warnings.join('\n'));
      }
      
      if (result.success && result.assignments?.length > 0) {
        alert(t('allocation_success') || `تم توزيع ${result.assignments.length} معتمر بنجاح!`);
      }
      
      // Refresh data to show new assignments
      await fetchData();
    } catch (error: any) {
      console.error('Auto-allocate error:', error);
      alert(error.message || t('allocation_failed') || 'فشل توزيع الغرف');
    } finally {
      setAllocating(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm(t('confirm_delete') || 'هل أنت متأكد؟')) return;
    
    try {
      await api.deleteRoomAssignment(assignmentId);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!data) {
    return (
      <Alert color="red">
        {t('booking_not_found') || 'الحجز غير موجود'}
      </Alert>
    );
  }

  const { booking, pilgrims, assignments, hotels } = data;
  
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safePilgrims = Array.isArray(pilgrims) ? pilgrims : [];

  // Use hotels list when available; otherwise fallback to single hotel from booking
  const hotelList = Array.isArray(hotels) && hotels.length > 0 ? hotels : (
    booking.accommodation_id && booking.accommodations && booking.room_type_id && booking.room_types
      ? [{ accommodation: booking.accommodations, room_type: booking.room_types, accommodation_id: booking.accommodation_id, room_type_id: booking.room_type_id }]
      : []
  );

  const selectedHotel = hotelList[selectedHotelIndex] || null;
  const accId = selectedHotel?.accommodation_id || booking.accommodation_id;
  const rtId = selectedHotel?.room_type_id || booking.room_type_id;
  const selectedAccommodation = selectedHotel?.accommodation || booking.accommodations;
  const selectedRoomType = selectedHotel?.room_type || booking.room_types;

  // Filter assignments for the selected hotel AND room type (avoid mixing Double/Triple)
  const assignmentsForHotel = (accId && rtId)
    ? safeAssignments.filter(a =>
        (a.accommodation_id || booking.accommodation_id) === accId &&
        (a.room_type_id || booking.room_type_id) === rtId
      )
    : accId
      ? safeAssignments.filter(a => (a.accommodation_id || booking.accommodation_id) === accId)
      : safeAssignments;

  // Pilgrims concerned with THIS hotel tab only.
  // Exclude pilgrims already assigned to this SAME accommodation in a DIFFERENT room type
  // (one pilgrim = one room type per hotel, per booking).
  const pilgrimIdsForHotel = selectedHotel?.pilgrim_ids;
  const basePilgrims = pilgrimIdsForHotel !== undefined
    ? (Array.isArray(pilgrimIdsForHotel) ? safePilgrims.filter(p => pilgrimIdsForHotel.includes(p.id)) : [])
    : safePilgrims;
  const assignedToSameAccDifferentRoom = new Set(
    safeAssignments
      .filter(a => (a.accommodation_id || booking.accommodation_id) === accId && (a.room_type_id || booking.room_type_id) !== rtId)
      .map(a => a.pilgrim_id)
  );
  const pilgrimsForHotel = basePilgrims.filter(p => !assignedToSameAccDifferentRoom.has(p.id));

  // Unassigned pilgrims FOR THIS HOTEL (pilgrims concerned with this hotel who have no assignment)
  const assignedInHotelIds = new Set(assignmentsForHotel.map(a => a.pilgrim_id));
  const unassignedPilgrims = pilgrimsForHotel.filter(p => !assignedInHotelIds.has(p.id));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" onClick={() => navigate(`/bookings/${id}`)} leftSection={<ArrowRight size={18} />}>
            {t('back') || 'رجوع'}
          </Button>
          <Title order={2}>{t('room_allocation') || 'توزيع الغرف'}</Title>
          <Badge color="teal">{booking.booking_number}</Badge>
        </Group>
        <Group>
          <Button 
            variant="light" 
            leftSection={<Wand2 size={18} />} 
            onClick={handleAutoAllocate}
            loading={allocating}
          >
            {t('auto_allocate') || 'توزيع تلقائي'}
          </Button>
        </Group>
      </Group>

      {/* Hotel tabs when multiple hotels */}
      {hotelList.length > 1 && (
        <Tabs value={String(selectedHotelIndex)} onChange={(v) => v != null && setSelectedHotelIndex(Number(v))}>
          <Tabs.List>
            {hotelList.map((h, i) => {
              const hotelName = h.accommodation?.name_ar || h.accommodation?.name || `${t('hotel') || 'فندق'} ${i + 1}`;
              const roomType = h.room_type?.type ? ` - ${t(h.room_type.type) || h.room_type.type}` : '';
              const isDuplicate = hotelList.filter(x => (x.accommodation?.name_ar || x.accommodation?.name) === (h.accommodation?.name_ar || h.accommodation?.name)).length > 1;
              return (
                <Tabs.Tab key={`${h.accommodation_id}-${h.room_type_id}`} value={String(i)}>
                  {hotelName}{isDuplicate ? roomType : ''}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>
      )}

      {/* Info Cards */}
      <SimpleGrid cols={4}>
        <Card withBorder p="md">
          <Group>
            <Building2 size={24} />
            <div>
              <Text size="sm" c="dimmed">{t('hotel') || 'الفندق'}</Text>
              <Text fw={600}>{selectedAccommodation?.name_ar || selectedAccommodation?.name || '-'}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="md">
          <Group>
            <BedDouble size={24} />
            <div>
              <Text size="sm" c="dimmed">{t('room_type') || 'نوع الغرفة'}</Text>
              <Text fw={600}>{t(selectedRoomType?.type) || selectedRoomType?.type || '-'}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="md">
          <Group>
            <Users size={24} />
            <div>
              <Text size="sm" c="dimmed">{t('pilgrims') || 'المعتمرين'}</Text>
              <Text fw={600}>{pilgrimsForHotel.length}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="md" style={{ backgroundColor: unassignedPilgrims.length > 0 ? '#fff8e1' : '#e8f5e9' }}>
          <Group>
            {unassignedPilgrims.length > 0 ? <AlertCircle size={24} color="orange" /> : <CheckCircle size={24} color="green" />}
            <div>
              <Text size="sm" c="dimmed">{t('unassigned') || 'غير موزعين'}</Text>
              <Text fw={600} c={unassignedPilgrims.length > 0 ? 'orange' : 'green'}>
                {unassignedPilgrims.length}
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Rules Alert */}
      <Alert color="blue" variant="light" icon={<BedDouble size={18} />}>
        <Text size="sm">
          {t('allocation_rules_info') || 'يتم توزيع الغرف مع مراعاة الفصل بين الجنسين. المحارم يمكنهم المشاركة في نفس الغرفة.'}
        </Text>
      </Alert>

      {/* Booking details for comparison - why pilgrims appear per hotel */}
      <Accordion variant="contained">
        <Accordion.Item value="booking-details">
          <Accordion.Control icon={<Info size={18} />}>
            {t('booking_details_compare') || 'تفاصيل الحجز للمقارنة'}
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <div>
                <Text size="xs" fw={600} c="dimmed">Booking</Text>
                <Code block>
                  same_selection_for_all: {String((booking as any).same_selection_for_all ?? true)}
                  {'\n'}hotel_inventory_ids: {JSON.stringify((booking as any).hotel_inventory_ids ?? [])}
                </Code>
              </div>
              <div>
                <Text size="xs" fw={600} c="dimmed">Hotels from API (pilgrim_ids per hotel)</Text>
                {hotelList.map((h, i) => (
                  <Paper key={i} p="sm" mb="xs" withBorder>
                    <Group gap="xs" mb={4}>
                      <Badge size="sm">{(h.accommodation?.name_ar || h.accommodation?.name || '-')} - {(h.room_type?.type || '-')}</Badge>
                      <Text size="xs">pilgrim_ids: {(h.pilgrim_ids?.length ?? 0)}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {h.pilgrim_ids?.length ? safePilgrims.filter(p => h.pilgrim_ids!.includes(p.id)).map(p => p.full_name_ar || p.full_name).join(', ') : '(none)'}
                    </Text>
                  </Paper>
                ))}
              </div>
              <div>
                <Text size="xs" fw={600} c="dimmed">Pilgrims (hotel_inventory_ids per pilgrim)</Text>
                {safePilgrims.map((p) => (
                  <Paper key={p.id} p="xs" mb={4} withBorder>
                    <Text size="xs"><strong>{p.full_name_ar || p.full_name}</strong> — hotel_inventory_ids: {JSON.stringify((p as any).hotel_inventory_ids ?? [])}</Text>
                  </Paper>
                ))}
              </div>
              <div>
                <Text size="xs" fw={600} c="dimmed">Current tab (index {selectedHotelIndex})</Text>
                <Code block>
                  pilgrim_ids from API: {JSON.stringify(selectedHotel?.pilgrim_ids ?? [])}
                  {'\n'}basePilgrims: {basePilgrims.length}
                  {'\n'}excluded (assigned same acc, diff room): {Array.from(assignedToSameAccDifferentRoom).join(', ') || '(none)'}
                  {'\n'}pilgrimsForHotel: {pilgrimsForHotel.length}
                </Code>
              </div>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Room Map - click bed for pilgrim dropdown, or drag pilgrim to bed */}
      <RoomMap
            roomType={selectedRoomType ? { id: rtId || '', type: selectedRoomType.type, total_rooms: (selectedRoomType as any).total_rooms ?? 20, total_beds: selectedRoomType.total_beds ?? 2 } : null}
            assignments={assignmentsForHotel}
            pilgrims={pilgrimsForHotel}
            onAssignPilgrim={async (pilgrimId, roomNumber) => {
              if (!accId || !rtId) {
                alert(t('missing_accommodation_info') || 'معلومات السكن غير مكتملة');
                return;
              }
              try {
                await api.createRoomAssignment({
                  booking_id: id,
                  accommodation_id: accId,
                  room_type_id: rtId,
                  pilgrim_id: pilgrimId,
                  room_number: roomNumber
                });
                await fetchData();
              } catch (error: any) {
                alert(error.message || t('assignment_failed') || 'فشل تعيين الغرفة');
              }
            }}
            onRemoveAssignment={handleRemoveAssignment}
          />
    </Stack>
  );
}

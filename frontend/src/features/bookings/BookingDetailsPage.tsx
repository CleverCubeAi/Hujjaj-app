import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Table,
  Card,
  SimpleGrid,
  LoadingOverlay,
  Alert,
  Progress
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useAuth } from '../../providers/AuthProvider';
import { DeleteBookingModal } from './DeleteBookingModal';
import { notifications } from '@mantine/notifications';
import { formatLocalDate } from '../../lib/dates';
import {
  ArrowRight,
  User,
  Users,
  Plane,
  Building2,
  CreditCard,
  BedDouble,
  FileText,
  Phone,
  Calendar,
  Trash2,
  Clock,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface Booking {
  id: string;
  booking_number: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  notes?: string;
  created_at: string;
  confirmed_at?: string;
  hold_expires_at?: string;
  hold_session_id?: string;
  clients?: {
    id: string;
    full_name: string;
    full_name_ar?: string;
    phone: string;
    email?: string;
  };
  seasons?: {
    name: string;
    type: string;
  };
  flights?: {
    code: string;
    departure_city: string;
    arrival_city: string;
    departure_date: string;
  };
  accommodations?: {
    name: string;
    name_ar?: string;
    city: string;
  };
  room_types?: {
    type: string;
    price_per_bed: number;
  };
  pilgrims?: any[];
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  confirmed: 'blue',
  paid: 'green',
  cancelled: 'red',
  expired: 'orange'
};

const statusLabels: Record<string, string> = {
  draft: 'مسودة',
  confirmed: 'مؤكد',
  paid: 'مدفوع',
  cancelled: 'ملغى',
  expired: 'منتهي الصلاحية'
};

// Helper to calculate remaining hold time
function getHoldTimeRemaining(holdExpiresAt: string | undefined): { 
  hours: number; 
  minutes: number;
  percentage: number;
  status: 'active' | 'expiring_soon' | 'expired' | 'none' 
} {
  if (!holdExpiresAt) return { hours: 0, minutes: 0, percentage: 0, status: 'none' };
  
  const expiresAt = new Date(holdExpiresAt);
  const now = new Date();
  const totalMs = expiresAt.getTime() - now.getTime();
  const hoursLeft = totalMs / (1000 * 60 * 60);
  const minutesLeft = totalMs / (1000 * 60);
  
  // Calculate percentage (assuming 24 hour total)
  const percentage = Math.max(0, Math.min(100, (hoursLeft / 24) * 100));
  
  if (hoursLeft <= 0) return { hours: 0, minutes: 0, percentage: 0, status: 'expired' };
  if (hoursLeft <= 2) return { 
    hours: Math.floor(hoursLeft), 
    minutes: Math.round(minutesLeft % 60), 
    percentage, 
    status: 'expiring_soon' 
  };
  return { 
    hours: Math.floor(hoursLeft), 
    minutes: Math.round(minutesLeft % 60), 
    percentage, 
    status: 'active' 
  };
}

export function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { role } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingHotels, setBookingHotels] = useState<any[]>([]); // Issue #24: all hotels for multi-hotel
  const [loading, setLoading] = useState(true);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [extendingHold, setExtendingHold] = useState(false);
  
  const isAdmin = role === 'agency_admin' || role === 'super_admin';

  useEffect(() => {
    if (id) {
      fetchBooking();
    }
  }, [id]);

  const fetchBooking = async () => {
    try {
      const [data, hotels] = await Promise.all([
        api.getBookingById(id!),
        api.getBookingHotels(id!).catch(() => []),
      ]);
      setBooking(data);
      setBookingHotels(Array.isArray(hotels) ? hotels : []);
    } catch (error) {
      console.error('Error fetching booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingDeleted = () => {
    navigate('/bookings');
  };

  const handleExtendHold = async () => {
    if (!id) return;
    
    setExtendingHold(true);
    try {
      await api.extendBookingHold(id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('hold_extended') || 'تم تمديد فترة الحجز بنجاح',
        color: 'green'
      });
      fetchBooking();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'فشل في تمديد فترة الحجز',
        color: 'red'
      });
    } finally {
      setExtendingHold(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!booking) {
    return (
      <Alert color="red">
        {t('booking_not_found') || 'الحجز غير موجود'}
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" onClick={() => navigate('/bookings')} leftSection={<ArrowRight size={18} />}>
            {t('back') || 'رجوع'}
          </Button>
          <Title order={2}>
            {t('booking') || 'حجز'} #{booking.booking_number}
          </Title>
          <Badge color={statusColors[booking.status]} size="lg">
            {statusLabels[booking.status]}
          </Badge>
        </Group>
        <Group>
          <Button variant="light" leftSection={<FileText size={18} />} onClick={() => navigate(`/bookings/${id}/invoice`)}>
            {t('invoice') || 'الفاتورة'}
          </Button>
          <Button variant="light" leftSection={<CreditCard size={18} />} onClick={() => navigate(`/bookings/${id}/payment`)}>
            {t('add_payment') || 'إضافة دفعة'}
          </Button>
          <Button variant="light" leftSection={<BedDouble size={18} />} onClick={() => navigate(`/bookings/${id}/rooms`)}>
            {t('room_allocation') || 'توزيع الغرف'}
          </Button>
          {isAdmin && (booking.status === 'cancelled' || booking.status === 'expired') && (
            <Button 
              variant="light" 
              color="red" 
              leftSection={<Trash2 size={18} />} 
              onClick={() => setDeleteModalOpened(true)}
            >
              {t('delete') || 'حذف'}
            </Button>
          )}
        </Group>
      </Group>

      {/* Hold Status Alert for Draft Bookings */}
      {booking.status === 'draft' && booking.hold_expires_at && (() => {
        const holdInfo = getHoldTimeRemaining(booking.hold_expires_at);
        if (holdInfo.status === 'none') return null;
        
        const alertColor = holdInfo.status === 'expiring_soon' ? 'orange' : 
                          holdInfo.status === 'expired' ? 'red' : 'blue';
        const alertIcon = holdInfo.status === 'expiring_soon' ? <AlertTriangle size={20} /> : <Clock size={20} />;
        
        return (
          <Alert 
            icon={alertIcon} 
            color={alertColor} 
            title={t('booking_hold_status') || 'حالة حجز المخزون'}
            variant="light"
          >
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm">
                  {holdInfo.status === 'expired' 
                    ? (t('hold_expired_message') || 'انتهت صلاحية الحجز المؤقت. يجب تأكيد الحجز أو سيتم إلغاؤه تلقائياً.')
                    : holdInfo.status === 'expiring_soon'
                      ? (t('hold_expiring_soon') || `تحذير: سينتهي الحجز المؤقت خلال ${holdInfo.hours} ساعة و ${holdInfo.minutes} دقيقة`)
                      : (t('hold_active') || `الحجز محجوز مؤقتاً لمدة ${holdInfo.hours} ساعة و ${holdInfo.minutes} دقيقة`)
                  }
                </Text>
                <Button 
                  size="xs" 
                  variant="light"
                  leftSection={<RefreshCw size={14} />}
                  loading={extendingHold}
                  onClick={handleExtendHold}
                  disabled={holdInfo.status === 'expired'}
                >
                  {t('extend_hold') || 'تمديد الحجز'}
                </Button>
              </Group>
              <Progress 
                value={holdInfo.percentage} 
                color={alertColor}
                size="sm"
              />
              <Text size="xs" c="dimmed">
                {t('hold_expires_at') || 'ينتهي في'}: {new Date(booking.hold_expires_at).toLocaleString('ar')}
              </Text>
            </Stack>
          </Alert>
        );
      })()}

      {/* Expired Status Alert */}
      {booking.status === 'expired' && (
        <Alert icon={<AlertTriangle size={20} />} color="orange" title={t('booking_expired') || 'الحجز منتهي الصلاحية'}>
          <Text size="sm">
            {t('booking_expired_message') || 'انتهت صلاحية هذا الحجز لأنه لم يتم تأكيده خلال 24 ساعة. يمكن للمسؤول حذفه لإعادة المخزون.'}
          </Text>
        </Alert>
      )}

      <SimpleGrid cols={3}>
        {/* Client Info */}
        <Card withBorder p="md">
          <Group mb="sm">
            <User size={20} />
            <Text fw={600}>{t('client') || 'العميل'}</Text>
          </Group>
          <Stack gap="xs">
            <Text>{booking.clients?.full_name_ar || booking.clients?.full_name}</Text>
            <Group gap="xs">
              <Phone size={14} />
              <Text size="sm" c="dimmed">{booking.clients?.phone}</Text>
            </Group>
            {booking.clients?.email && (
              <Text size="sm" c="dimmed">{booking.clients?.email}</Text>
            )}
          </Stack>
        </Card>

        {/* Season & Flight */}
        <Card withBorder p="md">
          <Group mb="sm">
            <Plane size={20} />
            <Text fw={600}>{t('trip_info') || 'معلومات الرحلة'}</Text>
          </Group>
          <Stack gap="xs">
            <Badge variant="light" color="brown">{booking.seasons?.name} ({booking.seasons?.type})</Badge>
            {booking.flights && (
              <>
                <Text size="sm">{booking.flights.code}</Text>
                <Text size="sm" c="dimmed">
                  {booking.flights.departure_city} → {booking.flights.arrival_city}
                </Text>
                <Group gap="xs">
                  <Calendar size={14} />
                  <Text size="sm">{formatLocalDate(booking.flights.departure_date)}</Text>
                </Group>
              </>
            )}
          </Stack>
        </Card>

        {/* Accommodation — Issue #24 fix: list ALL hotels for multi-hotel bookings */}
        <Card withBorder p="md">
          <Group mb="sm">
            <Building2 size={20} />
            <Text fw={600}>{t('accommodation') || 'السكن'}</Text>
          </Group>
          <Stack gap="xs">
            {bookingHotels.length > 0 ? (
              bookingHotels.map((h: any, i: number) => (
                <Group key={i} justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm">{h.accommodation?.name_ar || h.accommodation?.name}</Text>
                    <Text size="xs" c="dimmed">{h.accommodation?.city}</Text>
                  </div>
                  {h.room_type && (
                    <Badge variant="light">{t(h.room_type.type) || h.room_type.type}</Badge>
                  )}
                </Group>
              ))
            ) : (
              <>
                <Text>{booking.accommodations?.name_ar || booking.accommodations?.name}</Text>
                <Text size="sm" c="dimmed">{booking.accommodations?.city}</Text>
                {booking.room_types && (
                  <Badge variant="light">{t(booking.room_types.type) || booking.room_types.type}</Badge>
                )}
              </>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Financial Summary */}
      <Card withBorder p="md">
        <Group mb="md">
          <CreditCard size={20} />
          <Text fw={600}>{t('financial_summary') || 'الملخص المالي'}</Text>
        </Group>
        <SimpleGrid cols={3}>
          <div>
            <Text size="sm" c="dimmed">{t('total') || 'المجموع'}</Text>
            <Text size="xl" fw={700}>{booking.total_amount?.toLocaleString('en')} {t('mad') || 'MAD'}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">{t('paid') || 'المدفوع'}</Text>
            <Text size="xl" fw={700} c="green">{booking.paid_amount?.toLocaleString('en')} {t('mad') || 'MAD'}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">{t('remaining') || 'المتبقي'}</Text>
            <Text size="xl" fw={700} c={booking.remaining_balance > 0 ? 'red' : 'green'}>
              {booking.remaining_balance?.toLocaleString('en')} {t('mad') || 'MAD'}
            </Text>
          </div>
        </SimpleGrid>
      </Card>

      {/* Pilgrims */}
      <Card withBorder p="md">
        <Group mb="md" justify="space-between">
          <Group>
            <Users size={20} />
            <Text fw={600}>{t('pilgrims') || 'المعتمرين'} ({booking.pilgrims?.length || 0})</Text>
          </Group>
        </Group>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>{t('name') || 'الاسم'}</Table.Th>
              <Table.Th>{t('gender') || 'الجنس'}</Table.Th>
              <Table.Th>{t('passport_number') || 'رقم الجواز'}</Table.Th>
              <Table.Th>{t('phone') || 'الهاتف'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {booking.pilgrims?.map((pilgrim, idx) => (
              <Table.Tr key={pilgrim.id}>
                <Table.Td>{idx + 1}</Table.Td>
                <Table.Td>
                  <Text fw={500}>{pilgrim.full_name_ar || pilgrim.full_name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={pilgrim.gender === 'male' ? 'blue' : 'pink'} variant="light">
                    {pilgrim.gender === 'male' ? t('male') || 'ذكر' : t('female') || 'أنثى'}
                  </Badge>
                </Table.Td>
                <Table.Td>{pilgrim.passport_number || '-'}</Table.Td>
                <Table.Td>{pilgrim.phone || '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Notes */}
      {booking.notes && (
        <Card withBorder p="md">
          <Text fw={600} mb="sm">{t('notes') || 'ملاحظات'}</Text>
          <Text>{booking.notes}</Text>
        </Card>
      )}

      {/* Delete Booking Modal */}
      <DeleteBookingModal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        bookingId={booking.id}
        bookingNumber={booking.booking_number}
        onDeleted={handleBookingDeleted}
      />
    </Stack>
  );
}

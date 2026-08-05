import { useEffect, useState } from 'react';
import { 
  Title, 
  Paper, 
  Table, 
  Button, 
  Group, 
  TextInput, 
  Stack, 
  Text,
  Badge,
  Box,
  LoadingOverlay,
  Select,
  ActionIcon,
  Menu,
  Modal,
  PasswordInput,
  Checkbox,
  Alert,
  Tooltip
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../providers/AuthProvider';
import { notifications } from '@mantine/notifications';
import { 
  Plus, 
  Search, 
  Eye, 
  CreditCard, 
  BedDouble, 
  FileText,
  MoreVertical,
  CheckCircle,
  XCircle,
  Trash2,
  Archive,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface Booking {
  id: string;
  booking_number: string;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled' | 'expired';
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  created_at: string;
  confirmed_at?: string;
  deleted_at?: string;
  deletion_reason?: string;
  created_by?: string;
  hold_expires_at?: string;
  hold_session_id?: string;
  creator?: {
    id: string;
    full_name: string;
    branch_id?: string;
  };
  clients?: {
    full_name: string;
    full_name_ar?: string;
    phone: string;
  };
  seasons?: {
    name: string;
    type: string;
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
function getHoldTimeRemaining(holdExpiresAt: string | undefined): { hours: number; status: 'active' | 'expiring_soon' | 'expired' | 'none' } {
  if (!holdExpiresAt) return { hours: 0, status: 'none' };
  
  const expiresAt = new Date(holdExpiresAt);
  const now = new Date();
  const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursLeft <= 0) return { hours: 0, status: 'expired' };
  if (hoursLeft <= 2) return { hours: Math.round(hoursLeft * 10) / 10, status: 'expiring_soon' };
  return { hours: Math.round(hoursLeft * 10) / 10, status: 'active' };
}

// Hold countdown badge component
function HoldCountdownBadge({ holdExpiresAt }: { holdExpiresAt?: string }) {
  const { hours, status } = getHoldTimeRemaining(holdExpiresAt);
  
  if (status === 'none') return null;
  
  const color = status === 'expiring_soon' ? 'orange' : status === 'expired' ? 'red' : 'blue';
  const icon = status === 'expiring_soon' ? <AlertTriangle size={10} /> : <Clock size={10} />;
  
  return (
    <Tooltip label={`الحجز محجوز مؤقتاً حتى ${new Date(holdExpiresAt!).toLocaleString('ar')}`}>
      <Badge 
        size="xs" 
        color={color} 
        variant="light"
        leftSection={icon}
      >
        {status === 'expired' 
          ? 'انتهت الصلاحية' 
          : hours < 1 
            ? `${Math.round(hours * 60)} د` 
            : `${hours} س`
        }
      </Badge>
    </Tooltip>
  );
}

export function BookingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState<string | null>(null);
  
  // Permanent delete modal state
  const [permanentDeleteModal, setPermanentDeleteModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = role === 'agency_admin' || role === 'super_admin';
  const isManagerOrAdmin = role === 'manager' || isAdmin;

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await api.getBookings({
        status: statusFilter || undefined,
        season_id: seasonFilter || undefined,
        search: search || undefined,
        show_deleted: showDeleted || undefined
      });
      setBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data);
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(fetchBookings, 300);
    return () => clearTimeout(debounce);
  }, [search, statusFilter, seasonFilter, showDeleted]);

  const handleConfirm = async (id: string) => {
    try {
      await api.confirmBooking(id);
      fetchBookings();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الحجز؟')) return;
    try {
      await api.cancelBooking(id);
      fetchBookings();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const openPermanentDeleteModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setDeletePassword('');
    setDeleteConfirmed(false);
    setPermanentDeleteModal(true);
  };

  const handlePermanentDelete = async () => {
    if (!selectedBooking || !deletePassword || !deleteConfirmed) return;
    
    setDeleting(true);
    try {
      await api.permanentDeleteBooking(selectedBooking.id, { deletion_password: deletePassword });
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('booking_permanently_deleted') || 'تم حذف الحجز نهائياً',
        color: 'green'
      });
      setPermanentDeleteModal(false);
      fetchBookings();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'فشل في حذف الحجز',
        color: 'red'
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('bookings') || 'الحجوزات'}</Title>
        <Button leftSection={<Plus size={18} />} onClick={() => navigate('/bookings/new')}>
          {t('new_booking') || 'حجز جديد'}
        </Button>
      </Group>

      <Paper p="md" radius="lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFD0' }}>
        <Group mb="md">
          <TextInput
            placeholder={t('search') || 'بحث برقم الحجز أو اسم العميل...'}
            leftSection={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder={t('status') || 'الحالة'}
            data={[
              { value: '', label: 'الكل' },
              { value: 'draft', label: 'مسودة' },
              { value: 'confirmed', label: 'مؤكد' },
              { value: 'paid', label: 'مدفوع' },
              { value: 'cancelled', label: 'ملغى' },
              { value: 'expired', label: 'منتهي الصلاحية' }
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={150}
          />
          <Select
            placeholder={t('season') || 'الموسم'}
            data={[
              { value: '', label: 'الكل' },
              ...seasons.map(s => ({ value: s.id, label: s.name }))
            ]}
            value={seasonFilter}
            onChange={setSeasonFilter}
            clearable
            w={180}
          />
          {isAdmin && (
            <Select
              placeholder={t('show_deleted') || 'المحذوفة'}
              data={[
                { value: '', label: 'الحجوزات النشطة' },
                { value: 'true', label: 'المحذوفة فقط' },
                { value: 'all', label: 'الكل' }
              ]}
              value={showDeleted}
              onChange={setShowDeleted}
              leftSection={<Archive size={16} />}
              w={180}
            />
          )}
        </Group>

        <Box pos="relative">
          <LoadingOverlay visible={loading} />
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('booking_number') || 'رقم الحجز'}</Table.Th>
                <Table.Th>{t('client') || 'العميل'}</Table.Th>
                <Table.Th>{t('season') || 'الموسم'}</Table.Th>
                <Table.Th>{t('pilgrims') || 'المعتمرين'}</Table.Th>
                <Table.Th>{t('total') || 'المجموع'}</Table.Th>
                <Table.Th>{t('paid') || 'المدفوع'}</Table.Th>
                <Table.Th>{t('remaining') || 'المتبقي'}</Table.Th>
                <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                {isManagerOrAdmin && <Table.Th>{t('created_by') || 'أنشأه'}</Table.Th>}
                {showDeleted && <Table.Th>{t('deleted_at') || 'تاريخ الحذف'}</Table.Th>}
                <Table.Th>{t('actions') || 'إجراءات'}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {bookings.map((booking) => (
                <Table.Tr key={booking.id}>
                  <Table.Td>
                    <Text size="sm" fw={600} c="brown">
                      {booking.booking_number}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>
                        {booking.clients?.full_name_ar || booking.clients?.full_name || '-'}
                      </Text>
                      <Text size="xs" c="dimmed">{booking.clients?.phone}</Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="brown" size="sm">
                      {booking.seasons?.name || '-'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="filled" color="gray" size="sm">
                      {booking.pilgrims?.length || 0}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {Number(booking.total_amount || 0).toLocaleString('en')} MAD
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="green" fw={500}>
                      {Number(booking.paid_amount || 0).toLocaleString('en')} MAD
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={Number(booking.remaining_balance) > 0 ? 'red' : 'green'} fw={500}>
                      {Number(booking.remaining_balance || 0).toLocaleString('en')} MAD
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      <Badge color={statusColors[booking.status]} variant="light">
                        {statusLabels[booking.status]}
                      </Badge>
                      {booking.status === 'draft' && booking.hold_expires_at && (
                        <HoldCountdownBadge holdExpiresAt={booking.hold_expires_at} />
                      )}
                      {booking.deleted_at && (
                        <Badge color="dark" variant="light" size="xs">
                          محذوف
                        </Badge>
                      )}
                    </Stack>
                  </Table.Td>
                  {isManagerOrAdmin && (
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {booking.creator?.full_name || '-'}
                      </Text>
                    </Table.Td>
                  )}
                  {showDeleted && (
                    <Table.Td>
                      {booking.deleted_at ? (
                        <div>
                          <Text size="xs" c="dimmed">
                            {new Date(booking.deleted_at).toLocaleDateString('en')}
                          </Text>
                          {booking.deletion_reason && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {booking.deletion_reason}
                            </Text>
                          )}
                        </div>
                      ) : '-'}
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <MoreVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {!booking.deleted_at ? (
                          <>
                            <Menu.Item 
                              leftSection={<Eye size={14} />}
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              عرض التفاصيل
                            </Menu.Item>
                            <Menu.Item 
                              leftSection={<FileText size={14} />}
                              onClick={() => navigate(`/bookings/${booking.id}/invoice`)}
                            >
                              الفاتورة
                            </Menu.Item>
                            {booking.status === 'draft' && (
                              <Menu.Item 
                                leftSection={<CheckCircle size={14} />}
                                onClick={() => handleConfirm(booking.id)}
                                color="green"
                              >
                                تأكيد الحجز
                              </Menu.Item>
                            )}
                            {(booking.status === 'confirmed' || booking.status === 'paid') && (
                              <>
                                <Menu.Item 
                                  leftSection={<CreditCard size={14} />}
                                  onClick={() => navigate(`/bookings/${booking.id}/payment`)}
                                >
                                  إضافة دفعة
                                </Menu.Item>
                                <Menu.Item 
                                  leftSection={<BedDouble size={14} />}
                                  onClick={() => navigate(`/bookings/${booking.id}/rooms`)}
                                >
                                  توزيع الغرف
                                </Menu.Item>
                              </>
                            )}
                            {booking.status !== 'cancelled' && booking.status !== 'expired' && (
                              <Menu.Item 
                                leftSection={<XCircle size={14} />}
                                onClick={() => handleCancel(booking.id)}
                                color="red"
                              >
                                إلغاء الحجز
                              </Menu.Item>
                            )}
                            {/* Expired bookings can be deleted by admin to release inventory */}
                            {booking.status === 'expired' && isAdmin && (
                              <>
                                <Menu.Divider />
                                <Menu.Item 
                                  leftSection={<Trash2 size={14} />}
                                  onClick={() => openPermanentDeleteModal(booking)}
                                  color="red"
                                >
                                  حذف نهائي
                                </Menu.Item>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <Menu.Item 
                              leftSection={<Eye size={14} />}
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              عرض التفاصيل
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item 
                              leftSection={<Trash2 size={14} />}
                              onClick={() => openPermanentDeleteModal(booking)}
                              color="red"
                            >
                              حذف نهائي
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
              {bookings.length === 0 && !loading && (
                <Table.Tr>
                  <Table.Td colSpan={showDeleted ? 11 : (isManagerOrAdmin ? 10 : 9)}>
                    <Text ta="center" c="dimmed" py="xl">
                      {showDeleted === 'true' 
                        ? (t('no_deleted_bookings') || 'لا توجد حجوزات محذوفة')
                        : (t('no_data') || 'لا توجد حجوزات')
                      }
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Permanent Delete Modal */}
      <Modal
        opened={permanentDeleteModal}
        onClose={() => setPermanentDeleteModal(false)}
        title={
          <Group gap="sm">
            <Trash2 size={20} color="red" />
            <Text fw={600}>{t('permanent_delete') || 'حذف نهائي'}</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <Alert icon={<AlertTriangle size={16} />} color="red" variant="light">
            <Text fw={600} mb="xs">
              {t('permanent_delete_warning') || 'تحذير: هذا الإجراء لا يمكن التراجع عنه!'}
            </Text>
            <Text size="sm">
              {t('permanent_delete_info') || `سيتم حذف الحجز ${selectedBooking?.booking_number} من قاعدة البيانات نهائياً. لن تتمكن من استعادته.`}
            </Text>
          </Alert>

          {selectedBooking?.deletion_reason && (
            <div>
              <Text size="sm" fw={500}>{t('deletion_reason') || 'سبب الحذف'}:</Text>
              <Text size="sm" c="dimmed">{selectedBooking.deletion_reason}</Text>
            </div>
          )}

          <PasswordInput
            label={t('deletion_password') || 'كلمة مرور الحذف'}
            description={t('enter_deletion_password') || 'أدخل كلمة مرور الحذف الخاصة بك'}
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.currentTarget.value)}
            required
          />

          <Checkbox
            label={t('confirm_permanent_delete') || `أؤكد أنني أريد حذف الحجز ${selectedBooking?.booking_number} نهائياً`}
            checked={deleteConfirmed}
            onChange={(e) => setDeleteConfirmed(e.currentTarget.checked)}
            color="red"
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setPermanentDeleteModal(false)} disabled={deleting}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button
              color="red"
              onClick={handlePermanentDelete}
              loading={deleting}
              disabled={!deleteConfirmed || !deletePassword}
              leftSection={<Trash2 size={16} />}
            >
              {t('permanent_delete') || 'حذف نهائي'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

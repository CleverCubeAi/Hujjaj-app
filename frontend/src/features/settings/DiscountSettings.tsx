import { useEffect, useState } from 'react';
import {
  Paper,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Stack,
  Select,
  Title,
  ActionIcon,
  Badge,
  LoadingOverlay,
  Text,
  NumberInput,
  Switch,
  Tabs,
  Card,
  SimpleGrid,
  Alert
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { Plus, Edit, Trash2, Percent, DollarSign, Users, History, AlertCircle } from 'lucide-react';

interface DiscountSetting {
  id: string;
  name: string;
  name_ar?: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_discount_amount?: number;
  min_booking_amount?: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  created_by_user?: { full_name: string };
}

interface UserPermission {
  id: string;
  user_id: string;
  discount_setting_id: string;
  usage_limit: number | null;
  usage_count: number;
  reset_period: string;
  is_active: boolean;
  user?: { id: string; full_name: string; email: string };
  discount_setting?: DiscountSetting;
}

interface UsageLog {
  id: string;
  discount_name: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  booking_total_before: number;
  booking_total_after: number;
  created_at: string;
  user?: { full_name: string; email: string };
  booking?: { booking_number: string };
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

export function DiscountSettings() {
  const { t } = useTranslation();
  
  // Discount Settings State
  const [discounts, setDiscounts] = useState<DiscountSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountSetting | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DiscountSetting | null>(null);
  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: 0,
    max_discount_amount: null as number | null,
    min_booking_amount: null as number | null,
    is_default: false,
    is_active: true,
    sort_order: 0
  });

  // User Permissions State
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permForm, setPermForm] = useState({
    user_id: '',
    discount_setting_id: '',
    usage_limit: null as number | null,
    reset_period: 'monthly'
  });

  // Usage Log State
  const [usageLog, setUsageLog] = useState<UsageLog[]>([]);
  const [usageStats, setUsageStats] = useState<any>(null);

  useEffect(() => {
    fetchDiscounts();
    fetchUsers();
    fetchPermissions(); // Also fetch permissions on initial load
    fetchUsageLog(); // Also fetch usage log on initial load
  }, []);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const data = await api.getDiscountSettings();
      setDiscounts(data);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers({});
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const data = await api.getUserDiscountPermissions({});
      setPermissions(data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchUsageLog = async () => {
    try {
      const [log, stats] = await Promise.all([
        api.getDiscountUsageLog({ limit: 50 }),
        api.getDiscountUsageStats({})
      ]);
      setUsageLog(log);
      setUsageStats(stats);
    } catch (error) {
      console.error('Error fetching usage log:', error);
    }
  };

  const openCreateModal = () => {
    setEditingDiscount(null);
    setForm({
      name: '',
      name_ar: '',
      discount_type: 'percent',
      discount_value: 0,
      max_discount_amount: null,
      min_booking_amount: null,
      is_default: false,
      is_active: true,
      sort_order: discounts.length
    });
    setModalOpen(true);
  };

  const openEditModal = (discount: DiscountSetting) => {
    setEditingDiscount(discount);
    setForm({
      name: discount.name,
      name_ar: discount.name_ar || '',
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      max_discount_amount: discount.max_discount_amount || null,
      min_booking_amount: discount.min_booking_amount || null,
      is_default: discount.is_default,
      // Issue #8: default to true if the field comes back undefined/null from the API
      is_active: discount.is_active ?? true,
      sort_order: discount.sort_order
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    // Issue #9: clearer per-field validation messages (was: single misleading "required" toast)
    if (!form.name?.trim()) {
      notifications.show({ title: t('error') || 'Erreur', message: t('name_required') || 'Le nom de la remise est requis', color: 'red' });
      return;
    }
    if (!form.discount_value || form.discount_value <= 0) {
      notifications.show({ title: t('error') || 'Erreur', message: t('discount_value_positive') || 'La valeur doit être strictement positive', color: 'red' });
      return;
    }
    if (form.discount_type === 'percent' && form.discount_value > 100) {
      notifications.show({ title: t('error') || 'Erreur', message: t('percent_max_100') || 'Le pourcentage doit être entre 1 et 100', color: 'red' });
      return;
    }

    try {
      if (editingDiscount) {
        await api.updateDiscountSetting(editingDiscount.id, {
          ...form,
          max_discount_amount: form.max_discount_amount ?? undefined,
          min_booking_amount: form.min_booking_amount ?? undefined
        });
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('discount_updated') || 'تم تحديث الخصم',
          color: 'green'
        });
      } else {
        await api.createDiscountSetting({
          ...form,
          max_discount_amount: form.max_discount_amount ?? undefined,
          min_booking_amount: form.min_booking_amount ?? undefined
        });
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('discount_created') || 'تم إنشاء الخصم',
          color: 'green'
        });
      }
      setModalOpen(false);
      fetchDiscounts();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message,
        color: 'red'
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.deleteDiscountSetting(deleteConfirm.id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('discount_deleted') || 'تم حذف الخصم',
        color: 'green'
      });
      setDeleteConfirm(null);
      fetchDiscounts();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message,
        color: 'red'
      });
    }
  };

  const handleCreatePermission = async () => {
    if (!permForm.user_id || !permForm.discount_setting_id) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('select_user_and_discount') || 'يرجى اختيار المستخدم والخصم',
        color: 'red'
      });
      return;
    }

    try {
      await api.createUserDiscountPermission({
        user_id: permForm.user_id,
        discount_setting_id: permForm.discount_setting_id,
        usage_limit: permForm.usage_limit || undefined,
        reset_period: permForm.reset_period as any
      });
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('permission_created') || 'تم إنشاء الصلاحية',
        color: 'green'
      });
      setPermModalOpen(false);
      fetchPermissions();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message,
        color: 'red'
      });
    }
  };

  const handleDeletePermission = async (id: string) => {
    try {
      await api.deleteUserDiscountPermission(id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('permission_deleted') || 'تم حذف الصلاحية',
        color: 'green'
      });
      fetchPermissions();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message,
        color: 'red'
      });
    }
  };

  const formatDiscountValue = (discount: DiscountSetting) => {
    if (discount.discount_type === 'percent') {
      return `${discount.discount_value}%`;
    }
    return `${discount.discount_value} ${t('mad') || 'MAD'}`;
  };

  return (
    <Stack gap="xl">
      <Tabs defaultValue="settings" onChange={(value) => {
        if (value === 'permissions') fetchPermissions();
        if (value === 'usage') fetchUsageLog();
      }}>
        <Tabs.List>
          <Tabs.Tab value="settings" leftSection={<Percent size={16} />}>
            {t('discount_settings') || 'إعدادات الخصومات'}
          </Tabs.Tab>
          <Tabs.Tab value="permissions" leftSection={<Users size={16} />}>
            {t('user_permissions') || 'صلاحيات المستخدمين'}
          </Tabs.Tab>
          <Tabs.Tab value="usage" leftSection={<History size={16} />}>
            {t('usage_log') || 'سجل الاستخدام'}
          </Tabs.Tab>
        </Tabs.List>

        {/* Discount Settings Tab */}
        <Tabs.Panel value="settings" pt="xl">
          <Paper p="xl" radius="md" withBorder pos="relative">
            <LoadingOverlay visible={loading} />
            
            <Group justify="space-between" mb="xl">
              <Title order={3}>{t('discount_values') || 'قيم الخصومات'}</Title>
              <Button leftSection={<Plus size={18} />} onClick={openCreateModal}>
                {t('add_discount') || 'إضافة خصم'}
              </Button>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('name') || 'الاسم'}</Table.Th>
                  <Table.Th>{t('type') || 'النوع'}</Table.Th>
                  <Table.Th>{t('value') || 'القيمة'}</Table.Th>
                  <Table.Th>{t('max_amount') || 'الحد الأقصى'}</Table.Th>
                  <Table.Th>{t('default') || 'افتراضي'}</Table.Th>
                  <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                  <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {discounts.map((discount) => (
                  <Table.Tr key={discount.id}>
                    <Table.Td>
                      <div>
                        <Text fw={500}>{discount.name}</Text>
                        {discount.name_ar && (
                          <Text size="xs" c="dimmed">{discount.name_ar}</Text>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        color={discount.discount_type === 'percent' ? 'blue' : 'green'}
                        leftSection={discount.discount_type === 'percent' ? <Percent size={12} /> : <DollarSign size={12} />}
                      >
                        {discount.discount_type === 'percent' ? t('percentage') || 'نسبة مئوية' : t('fixed_amount') || 'مبلغ ثابت'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600} size="lg">{formatDiscountValue(discount)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {discount.max_discount_amount ? (
                        <Text>{discount.max_discount_amount} {t('mad') || 'MAD'}</Text>
                      ) : (
                        <Text c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {discount.is_default ? (
                        <Badge color="green">{t('yes') || 'نعم'}</Badge>
                      ) : (
                        <Badge color="gray" variant="light">{t('no') || 'لا'}</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={discount.is_active ? 'green' : 'red'}>
                        {discount.is_active ? t('active') || 'نشط' : t('inactive') || 'غير نشط'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon variant="subtle" onClick={() => openEditModal(discount)}>
                          <Edit size={16} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" onClick={() => setDeleteConfirm(discount)}>
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {discounts.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" c="dimmed" py="xl">
                        {t('no_discounts') || 'لا توجد خصومات. أضف خصماً جديداً للبدء.'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        {/* User Permissions Tab */}
        <Tabs.Panel value="permissions" pt="xl">
          <Paper p="xl" radius="md" withBorder>
            <Group justify="space-between" mb="xl">
              <Title order={3}>{t('user_discount_permissions') || 'صلاحيات خصومات المستخدمين'}</Title>
              <Button leftSection={<Plus size={18} />} onClick={() => {
                setPermForm({ user_id: '', discount_setting_id: '', usage_limit: null, reset_period: 'monthly' });
                setPermModalOpen(true);
              }}>
                {t('assign_discount') || 'تعيين خصم'}
              </Button>
            </Group>

            <Alert icon={<AlertCircle size={18} />} color="blue" mb="lg">
              {t('default_discounts_note') || 'الخصومات الافتراضية متاحة لجميع المستخدمين تلقائياً. هنا يمكنك تعيين خصومات إضافية لمستخدمين محددين.'}
            </Alert>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('user') || 'المستخدم'}</Table.Th>
                  <Table.Th>{t('discount') || 'الخصم'}</Table.Th>
                  <Table.Th>{t('usage_limit') || 'حد الاستخدام'}</Table.Th>
                  <Table.Th>{t('used') || 'المستخدم'}</Table.Th>
                  <Table.Th>{t('remaining') || 'المتبقي'}</Table.Th>
                  <Table.Th>{t('reset_period') || 'فترة التجديد'}</Table.Th>
                  <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {permissions.map((perm) => (
                  <Table.Tr key={perm.id}>
                    <Table.Td>
                      <Text fw={500}>{perm.user?.full_name || '-'}</Text>
                      <Text size="xs" c="dimmed">{perm.user?.email}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="blue">{perm.discount_setting?.name || '-'}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {perm.usage_limit ? perm.usage_limit : t('unlimited') || 'غير محدود'}
                    </Table.Td>
                    <Table.Td>{perm.usage_count}</Table.Td>
                    <Table.Td>
                      {perm.usage_limit ? (
                        <Badge color={perm.usage_limit - perm.usage_count > 0 ? 'green' : 'red'}>
                          {perm.usage_limit - perm.usage_count}
                        </Badge>
                      ) : (
                        <Badge color="gray">{t('unlimited') || '∞'}</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">
                        {perm.reset_period === 'daily' ? t('daily') || 'يومي' :
                         perm.reset_period === 'weekly' ? t('weekly') || 'أسبوعي' :
                         perm.reset_period === 'monthly' ? t('monthly') || 'شهري' :
                         t('never') || 'أبداً'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDeletePermission(perm.id)}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {permissions.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" c="dimmed" py="xl">
                        {t('no_permissions') || 'لا توجد صلاحيات مخصصة. الخصومات الافتراضية متاحة للجميع.'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        {/* Usage Log Tab */}
        <Tabs.Panel value="usage" pt="xl">
          <Stack gap="lg">
            {/* Stats Cards */}
            {usageStats && (
              <SimpleGrid cols={3}>
                <Card withBorder p="lg">
                  <Text size="sm" c="dimmed">{t('total_discounts_given') || 'إجمالي الخصومات'}</Text>
                  <Text size="xl" fw={700} c="green">
                    {usageStats.total_discount_amount?.toLocaleString() || 0} {t('mad') || 'MAD'}
                  </Text>
                </Card>
                <Card withBorder p="lg">
                  <Text size="sm" c="dimmed">{t('total_usage_count') || 'عدد مرات الاستخدام'}</Text>
                  <Text size="xl" fw={700}>{usageStats.total_usage_count || 0}</Text>
                </Card>
                <Card withBorder p="lg">
                  <Text size="sm" c="dimmed">{t('unique_users') || 'المستخدمون'}</Text>
                  <Text size="xl" fw={700}>{usageStats.unique_users || 0}</Text>
                </Card>
              </SimpleGrid>
            )}

            <Paper p="xl" radius="md" withBorder>
              <Title order={3} mb="xl">{t('recent_discount_usage') || 'سجل استخدام الخصومات'}</Title>
              
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('date') || 'التاريخ'}</Table.Th>
                    <Table.Th>{t('user') || 'المستخدم'}</Table.Th>
                    <Table.Th>{t('booking') || 'الحجز'}</Table.Th>
                    <Table.Th>{t('discount') || 'الخصم'}</Table.Th>
                    <Table.Th>{t('amount') || 'المبلغ'}</Table.Th>
                    <Table.Th>{t('booking_total') || 'إجمالي الحجز'}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {usageLog.map((log) => (
                    <Table.Tr key={log.id}>
                      <Table.Td>
                        {new Date(log.created_at).toLocaleDateString('ar-MA')}
                      </Table.Td>
                      <Table.Td>{log.user?.full_name || '-'}</Table.Td>
                      <Table.Td>
                        {log.booking?.booking_number ? (
                          <Badge variant="light">{log.booking.booking_number}</Badge>
                        ) : '-'}
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{log.discount_name}</Text>
                        <Text size="xs" c="dimmed">
                          {log.discount_type === 'percent' ? `${log.discount_value}%` : `${log.discount_value} MAD`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="red" size="lg">-{log.discount_amount} {t('mad') || 'MAD'}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{log.booking_total_before} → {log.booking_total_after}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {usageLog.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text ta="center" c="dimmed" py="xl">
                          {t('no_usage_log') || 'لا يوجد سجل استخدام بعد.'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Create/Edit Discount Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDiscount ? (t('edit_discount') || 'تعديل الخصم') : (t('add_discount') || 'إضافة خصم')}
        size="lg"
      >
        <Stack>
          <SimpleGrid cols={2}>
            <TextInput
              label={t('name') || 'الاسم'}
              placeholder="Discount 5%"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
              required
            />
            <TextInput
              label={t('name_ar') || 'الاسم بالعربية'}
              placeholder="خصم 5%"
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.currentTarget.value })}
              dir="rtl"
            />
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <Select
              label={t('discount_type') || 'نوع الخصم'}
              data={[
                { value: 'percent', label: t('percentage') || 'نسبة مئوية (%)' },
                { value: 'fixed', label: t('fixed_amount') || 'مبلغ ثابت (MAD)' }
              ]}
              value={form.discount_type}
              onChange={(v) => setForm({ ...form, discount_type: v as 'percent' | 'fixed' })}
              required
            />
            <NumberInput
              label={form.discount_type === 'percent' ? (t('percentage_value') || 'النسبة (%)') : (t('amount') || 'المبلغ (MAD)')}
              value={form.discount_value}
              onChange={(v) => setForm({ ...form, discount_value: Number(v) || 0 })}
              min={0}
              max={form.discount_type === 'percent' ? 100 : undefined}
              required
            />
          </SimpleGrid>

          {form.discount_type === 'percent' && (
            <NumberInput
              label={t('max_discount_amount') || 'الحد الأقصى للخصم (MAD)'}
              description={t('max_discount_desc') || 'الحد الأقصى للمبلغ المخصوم حتى لو كانت النسبة أعلى'}
              value={form.max_discount_amount || ''}
              onChange={(v) => setForm({ ...form, max_discount_amount: v ? Number(v) : null })}
              min={0}
            />
          )}

          <NumberInput
            label={t('min_booking_amount') || 'الحد الأدنى للحجز (MAD)'}
            description={t('min_booking_desc') || 'لن يتم تطبيق الخصم إذا كان إجمالي الحجز أقل من هذا المبلغ'}
            value={form.min_booking_amount || ''}
            onChange={(v) => setForm({ ...form, min_booking_amount: v ? Number(v) : null })}
            min={0}
          />

          <SimpleGrid cols={2}>
            <Switch
              label={t('is_default') || 'خصم افتراضي'}
              description={t('is_default_desc') || 'متاح لجميع المستخدمين تلقائياً'}
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.currentTarget.checked })}
            />
            <Switch
              label={t('is_active') || 'نشط'}
              description={t('is_active_desc') || 'يمكن استخدام هذا الخصم'}
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.currentTarget.checked })}
            />
          </SimpleGrid>

          <NumberInput
            label={t('sort_order') || 'ترتيب العرض'}
            value={form.sort_order}
            onChange={(v) => setForm({ ...form, sort_order: Number(v) || 0 })}
            min={0}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button onClick={handleSubmit}>
              {editingDiscount ? (t('update') || 'تحديث') : (t('create') || 'إنشاء')}
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
        <Stack>
          <Text>
            {t('delete_discount_confirm') || `هل أنت متأكد من حذف "${deleteConfirm?.name}"؟ لن يتمكن المستخدمون من استخدام هذا الخصم بعد الآن.`}
          </Text>
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('cancel') || 'إلغاء'}</Button>
            <Button color="red" onClick={handleDelete}>{t('delete') || 'حذف'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Assign Permission Modal */}
      <Modal
        opened={permModalOpen}
        onClose={() => setPermModalOpen(false)}
        title={t('assign_discount_to_user') || 'تعيين خصم للمستخدم'}
      >
        <Stack>
          <Select
            label={t('user') || 'المستخدم'}
            placeholder={t('select_user') || 'اختر المستخدم'}
            data={users.map(u => ({ value: u.id, label: `${u.full_name} (${u.email})` }))}
            value={permForm.user_id}
            onChange={(v) => setPermForm({ ...permForm, user_id: v || '' })}
            searchable
            required
          />
          <Select
            label={t('discount') || 'الخصم'}
            placeholder={t('select_discount') || 'اختر الخصم'}
            data={discounts
              .filter(d => !d.is_default && d.is_active)
              .map(d => ({ value: d.id, label: `${d.name} (${formatDiscountValue(d)})` }))}
            value={permForm.discount_setting_id}
            onChange={(v) => setPermForm({ ...permForm, discount_setting_id: v || '' })}
            required
          />
          <NumberInput
            label={t('usage_limit') || 'حد الاستخدام'}
            description={t('usage_limit_desc') || 'اتركه فارغاً للاستخدام غير المحدود'}
            value={permForm.usage_limit || ''}
            onChange={(v) => setPermForm({ ...permForm, usage_limit: v ? Number(v) : null })}
            min={1}
          />
          <Select
            label={t('reset_period') || 'فترة تجديد الاستخدام'}
            data={[
              { value: 'daily', label: t('daily') || 'يومي' },
              { value: 'weekly', label: t('weekly') || 'أسبوعي' },
              { value: 'monthly', label: t('monthly') || 'شهري' },
              { value: 'never', label: t('never') || 'أبداً (لا يتجدد)' }
            ]}
            value={permForm.reset_period}
            onChange={(v) => setPermForm({ ...permForm, reset_period: v || 'monthly' })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setPermModalOpen(false)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button onClick={handleCreatePermission}>
              {t('assign') || 'تعيين'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

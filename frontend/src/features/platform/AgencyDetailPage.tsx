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
  Badge,
  LoadingOverlay,
  Text,
  PasswordInput,
  ActionIcon,
  SimpleGrid,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { ArrowRight, Plus, Edit, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { formatLocalDate } from '../../lib/dates';

interface AgencyUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface AgencyDetail {
  id: string;
  name: string;
  country?: string | null;
  status: string;
  subscription_plan: string;
  logo_url?: string | null;
  created_at: string;
  user_count: number;
  admin_count: number;
  users: AgencyUser[];
}

const emptyUserForm = {
  full_name: '',
  email: '',
  password: '',
  user_role: 'agency_admin',
};

export function AgencyDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<AgencyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    country: '',
    package_id: '',
    subscription_status: 'active',
    renews_at: '',
    note: '',
    status: 'active',
  });
  const [packages, setPackages] = useState<any[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AgencyUser | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUser, setDeleteUser] = useState<AgencyUser | null>(null);

  const fetchAgency = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [data, pkgs] = await Promise.all([api.getPlatformAgency(id), api.getPlatformPackages()]);
      setPackages(pkgs);
      setAgency(data);
      setForm({
        name: data.name || '',
        country: data.country || '',
        package_id: data.package_id || data.package?.id || '',
        subscription_status: data.subscription_status || 'active',
        renews_at: data.subscription_renews_at ? String(data.subscription_renews_at).slice(0, 10) : '',
        note: '',
        status: data.status || 'active',
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load agency',
        color: 'red',
      });
      navigate('/agencies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgency();
  }, [id]);

  const handleSaveAgency = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.updatePlatformAgency(id, {
        name: form.name,
        country: form.country || null,
        status: form.status,
      });
      if (form.package_id) {
        await api.assignAgencySubscription(id, {
          package_id: form.package_id,
          subscription_status: form.subscription_status,
          renews_at: form.renews_at ? new Date(form.renews_at).toISOString() : null,
          note: form.note || undefined,
        });
      }
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('agency_updated') || 'تم تحديث إعدادات الوكالة بنجاح',
        color: 'green',
      });
      fetchAgency();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to update agency',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setUserModalOpen(true);
  };

  const openEditUser = (user: AgencyUser) => {
    setEditingUser(user);
    setUserForm({
      full_name: user.full_name || '',
      email: user.email || '',
      password: '',
      user_role: user.role,
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!id) return;
    if (!userForm.full_name || !userForm.email || (!editingUser && !userForm.password)) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('fill_required_fields') || 'يرجى تعبئة الحقول المطلوبة',
        color: 'red',
      });
      return;
    }
    setSavingUser(true);
    try {
      if (editingUser) {
        await api.updatePlatformAgencyUser(id, editingUser.id, {
          full_name: userForm.full_name,
          email: userForm.email,
          user_role: userForm.user_role,
          ...(userForm.password ? { password: userForm.password } : {}),
        });
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('user_updated') || 'تم تحديث المستخدم بنجاح',
          color: 'green',
        });
      } else {
        await api.createPlatformAgencyUser(id, userForm);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('user_created') || 'تم إنشاء المستخدم بنجاح',
          color: 'green',
        });
      }
      setUserModalOpen(false);
      fetchAgency();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to save user',
        color: 'red',
      });
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!id || !deleteUser) return;
    try {
      await api.deletePlatformAgencyUser(id, deleteUser.id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('user_deleted') || 'تم حذف المستخدم بنجاح',
        color: 'green',
      });
      setDeleteUser(null);
      fetchAgency();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to delete user',
        color: 'red',
      });
    }
  };

  const roleLabel = (role: string) => {
    if (role === 'agency_admin') return t('agency_admin') || 'مدير الوكالة';
    if (role === 'manager') return t('manager') || 'مدير';
    return t('agent') || 'وكيل';
  };

  return (
    <Stack gap="lg" pos="relative">
      <LoadingOverlay visible={loading} />
      <Group>
        <Button variant="subtle" color="teal" leftSection={<ArrowRight size={16} />} onClick={() => navigate('/agencies')}>
          {t('agencies') || 'الوكالات'}
        </Button>
      </Group>

      <Title order={2}>{agency?.name || t('agency') || 'الوكالة'}</Title>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Paper p="lg" radius="lg" style={{ backgroundColor: '#F8F6F0', border: '1px solid #E2D9C8' }}>
          <Title order={4} mb="md">{t('subscription_and_account') || 'الاشتراك والحساب'}</Title>
          <Stack>
            <TextInput
              label={t('agency_name') || 'اسم الوكالة'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            />
            <TextInput
              label={t('country') || 'البلد'}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.currentTarget.value })}
            />
            <Select
              label={t('subscription_plan') || 'خطة الاشتراك'}
              value={form.package_id}
              onChange={(value) => setForm({ ...form, package_id: value || '' })}
              data={packages.filter((p) => p.is_active || p.id === form.package_id).map((p) => ({
                value: p.id,
                label: `${p.name_fr} / ${p.name_ar}`,
              }))}
            />
            <Select
              label={t('subscription_status') || 'حالة الاشتراك'}
              value={form.subscription_status}
              onChange={(value) => setForm({ ...form, subscription_status: value || 'active' })}
              data={['trialing', 'active', 'past_due', 'cancelled'].map((v) => ({ value: v, label: v }))}
            />
            <TextInput
              label={t('renews_at') || 'تاريخ التجديد'}
              type="date"
              value={form.renews_at}
              onChange={(e) => setForm({ ...form, renews_at: e.currentTarget.value })}
            />
            <TextInput
              label={t('note') || 'ملاحظة'}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.currentTarget.value })}
            />
            <Select
              label={t('status') || 'الحالة'}
              value={form.status}
              onChange={(value) => setForm({ ...form, status: value || 'active' })}
              data={[
                { value: 'active', label: t('active') || 'نشط' },
                { value: 'inactive', label: t('inactive') || 'غير نشط' },
                { value: 'suspended', label: t('suspended') || 'معلق' },
              ]}
            />
            <Button color="teal" loading={saving} onClick={handleSaveAgency}>
              {t('save') || 'حفظ'}
            </Button>
          </Stack>
        </Paper>

        <Paper p="lg" radius="lg" style={{ backgroundColor: '#F8F6F0', border: '1px solid #E2D9C8' }}>
          <Title order={4} mb="sm">{t('account_summary') || 'ملخص الحساب'}</Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text c="dimmed">{t('users') || 'المستخدمون'}</Text>
              <Text fw={600}>{agency?.user_count ?? 0}</Text>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">{t('agency_admin') || 'مدير الوكالة'}</Text>
              <Text fw={600}>{agency?.admin_count ?? 0}</Text>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">{t('created_at') || 'تاريخ الإنشاء'}</Text>
              <Text fw={600}>{formatLocalDate(agency?.created_at)}</Text>
            </Group>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" radius="lg" style={{ backgroundColor: '#F8F6F0', border: '1px solid #E2D9C8' }}>
        <Group justify="space-between" mb="md">
          <Title order={4}>{t('agency_accounts') || 'حسابات الوكالة'}</Title>
          <Button leftSection={<Plus size={16} />} color="teal" onClick={openCreateUser}>
            {t('add_user') || 'إضافة مستخدم'}
          </Button>
        </Group>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('full_name') || 'الاسم الكامل'}</Table.Th>
              <Table.Th>{t('email') || 'البريد الإلكتروني'}</Table.Th>
              <Table.Th>{t('role') || 'الدور'}</Table.Th>
              <Table.Th>{t('created_at') || 'تاريخ الإنشاء'}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(agency?.users || []).length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md">{t('no_data') || 'لا توجد بيانات'}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              (agency?.users || []).map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>{user.full_name}</Table.Td>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="teal">{roleLabel(user.role)}</Badge>
                  </Table.Td>
                  <Table.Td>{formatLocalDate(user.created_at)}</Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <ActionIcon variant="subtle" color="teal" onClick={() => openEditUser(user)}>
                        <Edit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => setDeleteUser(user)}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal
        opened={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? (t('edit_user') || 'تعديل مستخدم') : (t('add_user') || 'إضافة مستخدم')}
      >
        <Stack>
          <TextInput
            label={t('full_name') || 'الاسم الكامل'}
            required
            value={userForm.full_name}
            onChange={(e) => setUserForm({ ...userForm, full_name: e.currentTarget.value })}
          />
          <TextInput
            label={t('email') || 'البريد الإلكتروني'}
            required
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.currentTarget.value })}
          />
          <Select
            label={t('role') || 'الدور'}
            value={userForm.user_role}
            onChange={(value) => setUserForm({ ...userForm, user_role: value || 'agency_admin' })}
            data={[
              { value: 'agency_admin', label: t('agency_admin') || 'مدير الوكالة' },
              { value: 'manager', label: t('manager') || 'مدير' },
              { value: 'agent', label: t('agent') || 'وكيل' },
            ]}
          />
          <PasswordInput
            label={editingUser ? (t('new_password') || 'كلمة المرور الجديدة') : (t('password') || 'كلمة المرور')}
            description={editingUser ? (t('leave_blank_to_keep') || 'اتركه فارغاً للاحتفاظ بالقيمة الحالية') : undefined}
            required={!editingUser}
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.currentTarget.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setUserModalOpen(false)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button color="teal" loading={savingUser} onClick={handleSaveUser}>
              {t('save') || 'حفظ'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title={t('confirm_delete') || 'هل أنت متأكد من الحذف؟'}
      >
        <Text mb="md">{t('confirm_delete_user') || 'هل أنت متأكد من حذف هذا المستخدم؟'}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteUser(null)}>
            {t('cancel') || 'إلغاء'}
          </Button>
          <Button color="red" onClick={handleDeleteUser}>
            {t('delete') || 'حذف'}
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

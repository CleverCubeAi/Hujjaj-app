import { useEffect, useState } from 'react';
import {
  Paper,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Stack,
  Title,
  ActionIcon,
  Badge,
  LoadingOverlay,
  Text,
  Tabs,
  Switch,
  Textarea,
  Alert
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { Plus, Search, Edit, Trash2, Building2, MapPin, Phone, Mail, User, CreditCard, AlertCircle } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

interface Branch {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_iban: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
}

interface BranchFormData {
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  contact_person: string;
  logo_url: string;
  bank_name: string;
  bank_account: string;
  bank_iban: string;
  is_headquarters: boolean;
  is_active: boolean;
}

const initialFormData: BranchFormData = {
  name: '',
  city: '',
  address: '',
  phone: '',
  email: '',
  contact_person: '',
  logo_url: '',
  bank_name: '',
  bank_account: '',
  bank_iban: '',
  is_headquarters: false,
  is_active: true
};

export function BranchManagement() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const isAdmin = role === 'agency_admin' || role === 'super_admin';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchBranches();
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const data = await api.getBranches({ search: search || undefined });
      setBranches(data);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load branches',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initialFormData);
    setEditingBranch(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name || '',
      city: branch.city || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      contact_person: branch.contact_person || '',
      logo_url: branch.logo_url || '',
      bank_name: branch.bank_name || '',
      bank_account: branch.bank_account || '',
      bank_iban: branch.bank_iban || '',
      is_headquarters: branch.is_headquarters || false,
      is_active: branch.is_active !== false
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('branch_name_required') || 'اسم الفرع مطلوب',
        color: 'red'
      });
      return;
    }

    setSaving(true);
    try {
      if (editingBranch) {
        await api.updateBranch(editingBranch.id, form);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('branch_updated') || 'تم تحديث الفرع بنجاح',
          color: 'green'
        });
      } else {
        await api.createBranch(form);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('branch_created') || 'تم إنشاء الفرع بنجاح',
          color: 'green'
        });
      }
      setModalOpen(false);
      resetForm();
      fetchBranches();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to save branch',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const result = await api.deleteBranch(deleteConfirm.id);
      
      if (result.deactivated) {
        notifications.show({
          title: t('info') || 'معلومة',
          message: t('branch_deactivated') || 'تم إلغاء تفعيل الفرع (يحتوي على مستخدمين)',
          color: 'yellow'
        });
      } else {
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('branch_deleted') || 'تم حذف الفرع بنجاح',
          color: 'green'
        });
      }
      
      setDeleteConfirm(null);
      fetchBranches();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to delete branch',
        color: 'red'
      });
    }
  };

  const getStatusBadge = (branch: Branch) => {
    if (branch.is_headquarters) {
      return (
        <Badge color="gold" variant="filled">
          {t('headquarters') || 'المقر الرئيسي'}
        </Badge>
      );
    }
    if (!branch.is_active) {
      return (
        <Badge color="gray" variant="outline">
          {t('inactive') || 'غير نشط'}
        </Badge>
      );
    }
    return (
      <Badge color="green" variant="light">
        {t('active') || 'نشط'}
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <Paper p="xl">
        <Alert icon={<AlertCircle size={16} />} color="yellow">
          {t('admin_only_feature') || 'هذه الميزة متاحة للمسؤولين فقط'}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Group justify="space-between" mb="md">
        <Title order={3}>
          {t('branch_management') || 'إدارة الفروع'}
        </Title>
        <Button leftSection={<Plus size={16} />} onClick={openCreateModal}>
          {t('add_branch') || 'إضافة فرع'}
        </Button>
      </Group>

      <TextInput
        placeholder={t('search_branches') || 'البحث عن الفروع...'}
        leftSection={<Search size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="md"
      />

      {branches.length === 0 && !loading ? (
        <Paper p="xl" withBorder ta="center">
          <Building2 size={48} style={{ opacity: 0.3 }} />
          <Text c="dimmed" mt="md">
            {t('no_branches_yet') || 'لا توجد فروع حتى الآن'}
          </Text>
          <Button mt="md" onClick={openCreateModal}>
            {t('create_first_branch') || 'إنشاء أول فرع'}
          </Button>
        </Paper>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('branch_name') || 'اسم الفرع'}</Table.Th>
              <Table.Th>{t('city') || 'المدينة'}</Table.Th>
              <Table.Th>{t('contact_person') || 'جهة الاتصال'}</Table.Th>
              <Table.Th>{t('phone') || 'الهاتف'}</Table.Th>
              <Table.Th>{t('status') || 'الحالة'}</Table.Th>
              <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {branches.map((branch) => (
              <Table.Tr key={branch.id} style={{ opacity: branch.is_active ? 1 : 0.6 }}>
                <Table.Td>
                  <Group gap="xs">
                    <Building2 size={16} />
                    <Text fw={500}>{branch.name}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {branch.city && (
                    <Group gap="xs">
                      <MapPin size={14} />
                      {branch.city}
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>{branch.contact_person || '-'}</Table.Td>
                <Table.Td>{branch.phone || '-'}</Table.Td>
                <Table.Td>{getStatusBadge(branch)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="teal"
                      onClick={() => openEditModal(branch)}
                    >
                      <Edit size={16} />
                    </ActionIcon>
                    {!branch.is_headquarters && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteConfirm(branch)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingBranch ? t('edit_branch') || 'تعديل الفرع' : t('add_branch') || 'إضافة فرع'}
        size="lg"
      >
        <Tabs defaultValue="basic">
          <Tabs.List>
            <Tabs.Tab value="basic" leftSection={<Building2 size={14} />}>
              {t('basic_info') || 'المعلومات الأساسية'}
            </Tabs.Tab>
            <Tabs.Tab value="contact" leftSection={<Phone size={14} />}>
              {t('contact_info') || 'معلومات الاتصال'}
            </Tabs.Tab>
            <Tabs.Tab value="banking" leftSection={<CreditCard size={14} />}>
              {t('banking_info') || 'المعلومات البنكية'}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="basic" pt="md">
            <Stack gap="md">
              <TextInput
                label={t('branch_name') || 'اسم الفرع'}
                placeholder={t('branch_name_placeholder') || 'مثال: فرع الدار البيضاء'}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
                required
                leftSection={<Building2 size={16} />}
              />

              <TextInput
                label={t('city') || 'المدينة'}
                placeholder={t('city_placeholder') || 'مثال: الدار البيضاء'}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.currentTarget.value })}
                leftSection={<MapPin size={16} />}
              />

              <Textarea
                label={t('address') || 'العنوان'}
                placeholder={t('address_placeholder') || 'العنوان الكامل للفرع'}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.currentTarget.value })}
                rows={2}
              />

              <Group>
                <Switch
                  label={t('is_headquarters') || 'المقر الرئيسي'}
                  description={t('headquarters_description') || 'تحديد هذا الفرع كمقر رئيسي'}
                  checked={form.is_headquarters}
                  onChange={(e) => setForm({ ...form, is_headquarters: e.currentTarget.checked })}
                />
                <Switch
                  label={t('is_active') || 'نشط'}
                  description={t('active_description') || 'تفعيل أو إلغاء تفعيل الفرع'}
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.currentTarget.checked })}
                />
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="contact" pt="md">
            <Stack gap="md">
              <TextInput
                label={t('contact_person') || 'جهة الاتصال'}
                placeholder={t('contact_person_placeholder') || 'اسم المسؤول'}
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.currentTarget.value })}
                leftSection={<User size={16} />}
              />

              <TextInput
                label={t('phone') || 'الهاتف'}
                placeholder={t('phone_placeholder') || '+212 XXX XXX XXX'}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })}
                leftSection={<Phone size={16} />}
              />

              <TextInput
                label={t('email') || 'البريد الإلكتروني'}
                placeholder={t('email_placeholder') || 'branch@agency.com'}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
                leftSection={<Mail size={16} />}
              />

              <TextInput
                label={t('logo_url') || 'رابط الشعار'}
                placeholder="https://..."
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.currentTarget.value })}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="banking" pt="md">
            <Stack gap="md">
              <TextInput
                label={t('bank_name') || 'اسم البنك'}
                placeholder={t('bank_name_placeholder') || 'مثال: البنك المغربي'}
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.currentTarget.value })}
              />

              <TextInput
                label={t('bank_account') || 'رقم الحساب'}
                placeholder={t('bank_account_placeholder') || 'رقم الحساب البنكي'}
                value={form.bank_account}
                onChange={(e) => setForm({ ...form, bank_account: e.currentTarget.value })}
              />

              <TextInput
                label={t('bank_iban') || 'IBAN'}
                placeholder="MA00 0000 0000 0000 0000 0000 000"
                value={form.bank_iban}
                onChange={(e) => setForm({ ...form, bank_iban: e.currentTarget.value })}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={() => {
            setModalOpen(false);
            resetForm();
          }}>
            {t('cancel') || 'إلغاء'}
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {t('save') || 'حفظ'}
          </Button>
        </Group>
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
            <Alert icon={<AlertCircle size={16} />} color="orange">
              {t('delete_branch_warning') || 'إذا كان الفرع يحتوي على مستخدمين، سيتم إلغاء تفعيله بدلاً من حذفه.'}
            </Alert>
            <Text>
              {t('confirm_delete_branch') || 'هل أنت متأكد من حذف هذا الفرع؟'}
            </Text>
            <Text fw={500} ta="center">
              {deleteConfirm.name}
              {deleteConfirm.city && ` - ${deleteConfirm.city}`}
            </Text>
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>
                {t('cancel') || 'إلغاء'}
              </Button>
              <Button color="red" onClick={handleDelete}>
                {t('delete') || 'حذف'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Paper>
  );
}

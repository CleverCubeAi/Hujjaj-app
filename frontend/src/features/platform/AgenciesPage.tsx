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
  Checkbox,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { Plus, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { formatLocalDate } from '../../lib/dates';

interface AgencyRow {
  id: string;
  name: string;
  country?: string | null;
  status: string;
  subscription_plan: string;
  package_slug?: string;
  user_count?: number;
  created_at: string;
}

const emptyForm = {
  name: '',
  country: '',
  package_id: '',
  status: 'active',
  admin_full_name: '',
  admin_email: '',
  admin_password: '',
  send_invite: false,
};

function statusColor(status: string) {
  if (status === 'active') return 'green';
  if (status === 'suspended') return 'red';
  return 'gray';
}

function planColor(plan: string) {
  if (plan === 'premium') return 'violet';
  if (plan === 'basic') return 'blue';
  return 'gray';
}

export function AgenciesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [packages, setPackages] = useState<any[]>([]);

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const data = await api.getPlatformAgencies({
        search: search || undefined,
        status: statusFilter || undefined,
        subscription_plan: planFilter || undefined,
      });
      setAgencies(data);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load agencies',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getPlatformPackages().then(setPackages).catch(() => undefined);
  }, []);

  useEffect(() => {
    const debounce = setTimeout(fetchAgencies, 250);
    return () => clearTimeout(debounce);
  }, [search, statusFilter, planFilter]);

  const handleCreate = async () => {
    if (!form.name || !form.admin_email || !form.admin_password || !form.admin_full_name) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('fill_required_fields') || 'يرجى تعبئة الحقول المطلوبة',
        color: 'red',
      });
      return;
    }
    setSaving(true);
    try {
      const created = await api.createPlatformAgency({
        name: form.name,
        country: form.country || null,
        package_id: form.package_id || undefined,
        status: form.status,
        admin_email: form.admin_email,
        admin_password: form.admin_password,
        admin_full_name: form.admin_full_name,
        send_invite: form.send_invite,
      });
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('agency_created') || 'تم إنشاء الوكالة بنجاح',
        color: 'green',
      });
      setModalOpen(false);
      setForm(emptyForm);
      navigate(`/agencies/${created.agency.id}`);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to create agency',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('agencies') || 'الوكالات'}</Title>
        <Button leftSection={<Plus size={16} />} color="teal" onClick={() => setModalOpen(true)}>
          {t('create_agency') || 'إنشاء وكالة'}
        </Button>
      </Group>

      <Paper p="md" radius="lg" style={{ backgroundColor: '#F8F6F0', border: '1px solid #E2D9C8' }} pos="relative">
        <LoadingOverlay visible={loading} />
        <Group mb="md" wrap="wrap">
          <TextInput
            placeholder={t('search_agencies') || 'البحث عن وكالة...'}
            leftSection={<Search size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            placeholder={t('status') || 'الحالة'}
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'active', label: t('active') || 'نشط' },
              { value: 'inactive', label: t('inactive') || 'غير نشط' },
              { value: 'suspended', label: t('suspended') || 'معلق' },
            ]}
            w={160}
          />
          <Select
            placeholder={t('subscription_plan') || 'خطة الاشتراك'}
            clearable
            value={planFilter}
            onChange={setPlanFilter}
            data={packages.map((p) => ({ value: p.slug, label: p.name_fr }))}
            w={160}
          />
        </Group>

        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('agency_name') || 'اسم الوكالة'}</Table.Th>
              <Table.Th>{t('country') || 'البلد'}</Table.Th>
              <Table.Th>{t('subscription_plan') || 'خطة الاشتراك'}</Table.Th>
              <Table.Th>{t('status') || 'الحالة'}</Table.Th>
              <Table.Th>{t('users') || 'المستخدمون'}</Table.Th>
              <Table.Th>{t('created_at') || 'تاريخ الإنشاء'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {agencies.length === 0 && !loading ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center" py="md">{t('no_data') || 'لا توجد بيانات'}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              agencies.map((agency) => (
                <Table.Tr
                  key={agency.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/agencies/${agency.id}`)}
                >
                  <Table.Td fw={500}>{agency.name}</Table.Td>
                  <Table.Td>{agency.country || '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={planColor(agency.package_slug || agency.subscription_plan)}>
                      {agency.package_slug || agency.subscription_plan}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={statusColor(agency.status)}>
                      {t(agency.status) || agency.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{agency.user_count ?? 0}</Table.Td>
                  <Table.Td>{formatLocalDate(agency.created_at)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('create_agency') || 'إنشاء وكالة'}
        size="md"
      >
        <Stack>
          <TextInput
            label={t('agency_name') || 'اسم الوكالة'}
            required
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
            data={packages.filter((p) => p.is_active).map((p) => ({ value: p.id, label: `${p.name_fr} / ${p.name_ar}` }))}
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
          <Text size="sm" fw={600} mt="xs">{t('agency_admin_account') || 'حساب مدير الوكالة'}</Text>
          <TextInput
            label={t('full_name') || 'الاسم الكامل'}
            required
            value={form.admin_full_name}
            onChange={(e) => setForm({ ...form, admin_full_name: e.currentTarget.value })}
          />
          <TextInput
            label={t('email') || 'البريد الإلكتروني'}
            required
            value={form.admin_email}
            onChange={(e) => setForm({ ...form, admin_email: e.currentTarget.value })}
          />
          <PasswordInput
            label={t('password') || 'كلمة المرور'}
            required
            value={form.admin_password}
            onChange={(e) => setForm({ ...form, admin_password: e.currentTarget.value })}
          />
          <Checkbox
            label={t('send_invite') || 'إرسال بريد تسجيل الدخول'}
            checked={form.send_invite}
            onChange={(e) => setForm({ ...form, send_invite: e.currentTarget.checked })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button color="teal" loading={saving} onClick={handleCreate}>
              {t('create') || 'إنشاء'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

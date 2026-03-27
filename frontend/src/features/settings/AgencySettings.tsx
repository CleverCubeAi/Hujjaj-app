import { useEffect, useState } from 'react';
import {
  Paper,
  Stack,
  TextInput,
  Select,
  Button,
  Title,
  Text,
  LoadingOverlay,
  Group,
  Box
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../providers/AuthProvider';
import { ImageUpload } from '../../components/common/ImageUpload';

interface Agency {
  id: string;
  name: string;
  country?: string;
  status: string;
  subscription_plan: string;
  logo_url?: string;
}

export function AgencySettings() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const isAdmin = role === 'agency_admin' || role === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [_agency, setAgency] = useState<Agency | null>(null);
  const [form, setForm] = useState({
    name: '',
    country: '',
    status: 'active',
    subscription_plan: 'free',
    logo_url: '' as string | null
  });

  useEffect(() => {
    fetchAgency();
  }, []);

  const fetchAgency = async () => {
    setLoading(true);
    try {
      const data = await api.getAgency();
      setAgency(data);
      setForm({
        name: data.name || '',
        country: data.country || '',
        status: data.status || 'active',
        subscription_plan: data.subscription_plan || 'free',
        logo_url: data.logo_url || null
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load agency settings',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateAgency(form);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('agency_updated') || 'تم تحديث إعدادات الوكالة بنجاح',
        color: 'green'
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to update agency settings',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Paper p="xl" pos="relative" style={{ minHeight: 200 }}>
        <LoadingOverlay visible />
      </Paper>
    );
  }

  return (
    <Paper p="xl">
      <Title order={3} mb="md">
        {t('agency_settings') || 'إعدادات الوكالة'}
      </Title>

      <Stack gap="md" mt="md">
        <Box>
          <Text size="sm" fw={500} mb="xs">{t('agency_logo') || 'شعار الوكالة'}</Text>
          <Group>
            <ImageUpload
              value={form.logo_url}
              onChange={(url) => setForm({ ...form, logo_url: url })}
              folder="agencies"
              size={100}
              placeholder={form.name}
              disabled={!isAdmin}
            />
            <Text size="xs" c="dimmed" maw={200}>
              {t('logo_hint') || 'يظهر الشعار في رأس الصفحة والفواتير. الحجم المثالي 200×200 بكسل.'}
            </Text>
          </Group>
        </Box>

        <TextInput
          label={t('agency_name') || 'اسم الوكالة'}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          required
          disabled={!isAdmin}
        />

        <TextInput
          label={t('country') || 'البلد'}
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.currentTarget.value })}
          disabled={!isAdmin}
        />

        <Select
          label={t('status') || 'الحالة'}
          value={form.status}
          onChange={(value) => setForm({ ...form, status: value || 'active' })}
          data={[
            { value: 'active', label: t('active') || 'نشط' },
            { value: 'inactive', label: t('inactive') || 'غير نشط' },
            { value: 'suspended', label: t('suspended') || 'معلق' }
          ]}
          disabled={!isAdmin}
        />

        <Select
          label={t('subscription_plan') || 'خطة الاشتراك'}
          value={form.subscription_plan}
          onChange={(value) => setForm({ ...form, subscription_plan: value || 'free' })}
          data={[
            { value: 'free', label: t('free') || 'مجاني' },
            { value: 'basic', label: t('basic') || 'أساسي' },
            { value: 'premium', label: t('premium') || 'مميز' }
          ]}
          disabled={!isAdmin}
        />

        {isAdmin && (
          <Button onClick={handleSave} loading={saving} mt="md">
            {t('save') || 'حفظ'}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

import { useEffect, useState } from 'react';
import {
  Paper, Stack, TextInput, Button, Title, Text, LoadingOverlay, Group, Box, ColorInput, Switch, Alert,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../providers/AuthProvider';
import { ImageUpload } from '../../components/common/ImageUpload';

export function AgencySettings() {
  const { t, i18n } = useTranslation();
  const { role } = useAuth();
  const isAdmin = role === 'agency_admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [packageName, setPackageName] = useState('');
  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    country: '',
    legal_name: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    status: 'active',
    subscription_plan: 'free',
    logo_url: '' as string | null,
    invoice_logo_url: '' as string | null,
    primary_color: '',
    invoice_footer: '',
    hide_platform_mark: false,
    billing_email: '',
  });

  useEffect(() => { fetchAgency(); }, []);

  const fetchAgency = async () => {
    setLoading(true);
    try {
      const [data, sub] = await Promise.all([api.getAgency(), api.getSubscription().catch(() => null)]);
      setWhiteLabel(!!sub?.features?.white_label);
      setPackageName(i18n.language === 'fr' ? sub?.package?.name_fr : sub?.package?.name_ar);
      setForm({
        name: data.name || '',
        name_ar: data.name_ar || '',
        country: data.country || '',
        legal_name: data.legal_name || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        website: data.website || '',
        status: data.status || 'active',
        subscription_plan: data.subscription_plan || sub?.package?.slug || 'free',
        logo_url: data.logo_url || null,
        invoice_logo_url: data.invoice_logo_url || null,
        primary_color: data.primary_color || '',
        invoice_footer: data.invoice_footer || '',
        hide_platform_mark: !!data.hide_platform_mark,
        billing_email: data.billing_email || '',
      });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (!whiteLabel) {
        delete payload.primary_color;
        delete payload.invoice_footer;
        delete payload.hide_platform_mark;
      }
      await api.updateAgency(payload);
      notifications.show({ title: t('success'), message: t('agency_updated'), color: 'green' });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Paper p="xl" pos="relative" style={{ minHeight: 200 }}><LoadingOverlay visible /></Paper>;
  }

  return (
    <Paper p="xl">
      <Title order={3} mb="md">{t('agency_settings')}</Title>
      <Stack gap="md">
        <Box>
          <Text size="sm" fw={500} mb="xs">{t('agency_logo')}</Text>
          <Group>
            <ImageUpload value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url })} folder="agencies" size={100} placeholder={form.name} disabled={!isAdmin} />
            <ImageUpload value={form.invoice_logo_url} onChange={(url) => setForm({ ...form, invoice_logo_url: url })} folder="agencies" size={100} placeholder={t('invoice_logo') || 'Invoice'} disabled={!isAdmin} />
          </Group>
        </Box>
        <TextInput label={t('agency_name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} required disabled={!isAdmin} />
        <TextInput label={t('agency_name_ar') || 'الاسم بالعربية'} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.currentTarget.value })} disabled={!isAdmin} />
        <TextInput label={t('legal_name') || 'الاسم القانوني'} value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.currentTarget.value })} disabled={!isAdmin} />
        <TextInput label={t('country')} value={form.country} onChange={(e) => setForm({ ...form, country: e.currentTarget.value })} disabled={!isAdmin} />
        <TextInput label={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} disabled={!isAdmin} />
        <TextInput label={t('email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} disabled={!isAdmin} />
        <TextInput label={t('address') || 'العنوان'} value={form.address} onChange={(e) => setForm({ ...form, address: e.currentTarget.value })} disabled={!isAdmin} />
        <TextInput label={t('website') || 'الموقع'} value={form.website} onChange={(e) => setForm({ ...form, website: e.currentTarget.value })} disabled={!isAdmin} />
        <TextInput label={t('billing_email') || 'بريد الفوترة'} value={form.billing_email} onChange={(e) => setForm({ ...form, billing_email: e.currentTarget.value })} disabled={!isAdmin} />
        <Text size="xs" c="dimmed">{t('subscription_managed_by_platform')} · {form.subscription_plan}</Text>
        {whiteLabel ? (
          <>
            <ColorInput label={t('primary_color')} value={form.primary_color} onChange={(v) => setForm({ ...form, primary_color: v })} disabled={!isAdmin} />
            <TextInput label={t('invoice_footer') || 'تذييل الفاتورة'} value={form.invoice_footer} onChange={(e) => setForm({ ...form, invoice_footer: e.currentTarget.value })} disabled={!isAdmin} />
            <Switch checked={form.hide_platform_mark} onChange={(e) => setForm({ ...form, hide_platform_mark: e.currentTarget.checked })} label={t('hide_platform_mark') || 'إخفاء علامة المنصة'} disabled={!isAdmin} />
          </>
        ) : (
          <Alert color="gray">{t('white_label_upgrade') || 'Available on {package}' .replace('{package}', packageName || 'Premium')}</Alert>
        )}
        {isAdmin && <Button onClick={handleSave} loading={saving} mt="md">{t('save')}</Button>}
      </Stack>
    </Paper>
  );
}

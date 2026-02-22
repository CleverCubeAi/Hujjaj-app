import React, { useEffect, useState } from 'react';
import {
  Paper,
  Stack,
  Select,
  TextInput,
  PasswordInput,
  Button,
  Title,
  LoadingOverlay,
  Badge,
  Group,
  Divider
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';

interface EmailSettings {
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password_encrypted?: string;
  from_email: string;
  from_name: string;
  test_status?: string;
  last_tested_at?: string;
}

const PRESET_CONFIGS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 587, secure: false }
};

export function EmailSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [form, setForm] = useState({
    provider: 'custom',
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    from_email: '',
    from_name: ''
  });
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getEmailSettings();
      if (data) {
        setSettings(data);
        setForm({
          provider: data.provider || 'custom',
          host: data.host || '',
          port: data.port || 587,
          secure: data.secure || false,
          username: data.username || '',
          password: '', // Don't show encrypted password
          from_email: data.from_email || '',
          from_name: data.from_name || ''
        });
      }
    } catch (error: any) {
      console.error('Error fetching email settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    if (provider === 'custom') {
      setForm({ ...form, provider, host: '', port: 587, secure: false });
    } else {
      const preset = PRESET_CONFIGS[provider];
      if (preset) {
        setForm({
          ...form,
          provider,
          host: preset.host,
          port: preset.port,
          secure: preset.secure
        });
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api.updateEmailSettings({
        provider: form.provider,
        host: form.host,
        port: form.port,
        secure: form.secure,
        username: form.username,
        password: form.password || undefined, // Only send if changed
        from_email: form.from_email,
        from_name: form.from_name
      });
      setSettings(data);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('email_settings_saved') || 'تم حفظ إعدادات البريد الإلكتروني بنجاح',
        color: 'green'
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to save email settings',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('test_email_required') || 'يرجى إدخال عنوان بريد إلكتروني للاختبار',
        color: 'red'
      });
      return;
    }

    setTesting(true);
    try {
      await api.testEmail({ test_email: testEmail });
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('test_email_sent') || 'تم إرسال بريد الاختبار بنجاح',
        color: 'green'
      });
      fetchSettings(); // Refresh to get updated test status
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to send test email',
        color: 'red'
      });
    } finally {
      setTesting(false);
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
      <Group justify="space-between" mb="md">
        <Title order={3}>
          {t('email_settings') || 'إعدادات البريد الإلكتروني'}
        </Title>
        {settings?.test_status && (
          <Badge color={settings.test_status === 'success' ? 'green' : 'red'}>
            {settings.test_status === 'success' ? t('tested') || 'تم الاختبار' : t('test_failed') || 'فشل الاختبار'}
          </Badge>
        )}
      </Group>

      <Stack gap="md" mt="md">
        <Select
          label={t('provider') || 'المزود'}
          value={form.provider}
          onChange={(value) => handleProviderChange(value || 'custom')}
          data={[
            { value: 'gmail', label: 'Gmail' },
            { value: 'outlook', label: 'Outlook/Office 365' },
            { value: 'yahoo', label: 'Yahoo' },
            { value: 'custom', label: t('custom') || 'مخصص' }
          ]}
        />

        <TextInput
          label={t('smtp_host') || 'خادم SMTP'}
          value={form.host}
          onChange={(e) => setForm({ ...form, host: e.currentTarget.value })}
          required
          disabled={form.provider !== 'custom'}
        />

        <TextInput
          label={t('port') || 'المنفذ'}
          type="number"
          value={form.port.toString()}
          onChange={(e) => setForm({ ...form, port: parseInt(e.currentTarget.value) || 587 })}
          required
          disabled={form.provider !== 'custom'}
        />

        <Select
          label={t('security') || 'الأمان'}
          value={form.secure ? 'ssl' : 'tls'}
          onChange={(value) => setForm({ ...form, secure: value === 'ssl' })}
          data={[
            { value: 'tls', label: 'TLS (587)' },
            { value: 'ssl', label: 'SSL (465)' }
          ]}
          disabled={form.provider !== 'custom'}
        />

        <TextInput
          label={t('username') || 'اسم المستخدم / البريد الإلكتروني'}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.currentTarget.value })}
          required
        />

        <PasswordInput
          label={t('password') || 'كلمة المرور'}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
          required={!settings}
          placeholder={settings ? t('leave_blank_to_keep') || 'اتركه فارغاً للاحتفاظ بالقيمة الحالية' : ''}
        />

        <TextInput
          label={t('from_email') || 'البريد الإلكتروني المرسل'}
          value={form.from_email}
          onChange={(e) => setForm({ ...form, from_email: e.currentTarget.value })}
          required
          type="email"
        />

        <TextInput
          label={t('from_name') || 'اسم المرسل'}
          value={form.from_name}
          onChange={(e) => setForm({ ...form, from_name: e.currentTarget.value })}
          required
        />

        <Divider my="md" />

        <TextInput
          label={t('test_email_address') || 'عنوان بريد إلكتروني للاختبار'}
          value={testEmail}
          onChange={(e) => setTestEmail(e.currentTarget.value)}
          type="email"
          placeholder={t('enter_email_to_test') || 'أدخل بريد إلكتروني لإرسال بريد اختبار'}
        />

        <Group>
          <Button onClick={handleTest} loading={testing} variant="outline">
            {t('test_connection') || 'اختبار الاتصال'}
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {t('save') || 'حفظ'}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

import { useEffect, useState } from 'react';
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

interface SMSSettings {
  provider: string;
  account_sid_encrypted?: string;
  auth_token_encrypted?: string;
  from_number?: string;
  api_url?: string;
  api_key_encrypted?: string;
  api_secret_encrypted?: string;
  test_status?: string;
  last_tested_at?: string;
}

export function SMSSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<SMSSettings | null>(null);
  const [form, setForm] = useState({
    provider: 'twilio',
    account_sid: '',
    auth_token: '',
    from_number: '',
    api_url: '',
    api_key: '',
    api_secret: ''
  });
  const [testPhoneNumber, setTestPhoneNumber] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSMSSettings();
      if (data) {
        setSettings(data);
        setForm({
          provider: data.provider || 'twilio',
          account_sid: '',
          auth_token: '',
          from_number: data.from_number || '',
          api_url: data.api_url || '',
          api_key: '',
          api_secret: ''
        });
      }
    } catch (error: any) {
      console.error('Error fetching SMS settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        provider: form.provider
      };

      if (form.provider === 'twilio') {
        if (!form.from_number) {
          throw new Error(t('from_number_required') || 'رقم الهاتف المرسل مطلوب');
        }
        payload.from_number = form.from_number;
        // Only send credentials if provided (for updating)
        if (form.account_sid) {
          payload.account_sid = form.account_sid;
        }
        if (form.auth_token) {
          payload.auth_token = form.auth_token;
        }
        // If no existing settings and no credentials provided, require them
        if (!settings && (!form.account_sid || !form.auth_token)) {
          throw new Error(t('twilio_credentials_required') || 'Account SID و Auth Token مطلوبان لإعدادات Twilio الجديدة');
        }
      } else if (form.provider === 'custom') {
        if (!form.api_url || !form.from_number) {
          throw new Error(t('api_url_from_number_required') || 'رابط API ورقم الهاتف المرسل مطلوبان');
        }
        payload.api_url = form.api_url;
        payload.from_number = form.from_number;
        // Only send credentials if provided (for updating)
        if (form.api_key) {
          payload.api_key = form.api_key;
        }
        if (form.api_secret) {
          payload.api_secret = form.api_secret;
        }
        // If no existing settings and no api_key provided, require it
        if (!settings && !form.api_key) {
          throw new Error(t('api_key_required') || 'مفتاح API مطلوب لإعدادات API المخصصة الجديدة');
        }
      }

      const data = await api.updateSMSSettings(payload);
      setSettings(data);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('sms_settings_saved') || 'تم حفظ إعدادات الرسائل النصية بنجاح',
        color: 'green'
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to save SMS settings',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testPhoneNumber) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('test_phone_required') || 'يرجى إدخال رقم هاتف للاختبار',
        color: 'red'
      });
      return;
    }

    setTesting(true);
    try {
      await api.testSMS({ test_phone_number: testPhoneNumber });
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('test_sms_sent') || 'تم إرسال رسالة الاختبار بنجاح',
        color: 'green'
      });
      fetchSettings(); // Refresh to get updated test status
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to send test SMS',
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
          {t('sms_settings') || 'إعدادات الرسائل النصية'}
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
          onChange={(value) => setForm({ ...form, provider: value || 'twilio' })}
          data={[
            { value: 'twilio', label: 'Twilio' },
            { value: 'custom', label: t('custom_api') || 'API مخصص' }
          ]}
        />

        {form.provider === 'twilio' && (
          <>
            <TextInput
              label={t('account_sid') || 'Account SID'}
              value={form.account_sid}
              onChange={(e) => setForm({ ...form, account_sid: e.currentTarget.value })}
              required={!settings}
              placeholder={settings?.account_sid_encrypted ? t('leave_blank_to_keep') || 'اتركه فارغاً للاحتفاظ بالقيمة الحالية' : ''}
            />

            <PasswordInput
              label={t('auth_token') || 'Auth Token'}
              value={form.auth_token}
              onChange={(e) => setForm({ ...form, auth_token: e.currentTarget.value })}
              required={!settings}
              placeholder={settings ? t('leave_blank_to_keep') || 'اتركه فارغاً للاحتفاظ بالقيمة الحالية' : ''}
            />

            <TextInput
              label={t('from_phone_number') || 'رقم الهاتف المرسل'}
              value={form.from_number}
              onChange={(e) => setForm({ ...form, from_number: e.currentTarget.value })}
              required
              placeholder="+1234567890"
            />
          </>
        )}

        {form.provider === 'custom' && (
          <>
            <TextInput
              label={t('api_url') || 'رابط API'}
              value={form.api_url}
              onChange={(e) => setForm({ ...form, api_url: e.currentTarget.value })}
              required
              placeholder="https://api.example.com/sms/send"
            />

            <PasswordInput
              label={t('api_key') || 'مفتاح API'}
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.currentTarget.value })}
              required={!settings}
              placeholder={settings ? t('leave_blank_to_keep') || 'اتركه فارغاً للاحتفاظ بالقيمة الحالية' : ''}
            />

            <PasswordInput
              label={t('api_secret') || 'سر API (اختياري)'}
              value={form.api_secret}
              onChange={(e) => setForm({ ...form, api_secret: e.currentTarget.value })}
              placeholder={settings ? t('leave_blank_to_keep') || 'اتركه فارغاً للاحتفاظ بالقيمة الحالية' : t('optional') || 'اختياري'}
            />

            <TextInput
              label={t('from_phone_number') || 'رقم الهاتف المرسل'}
              value={form.from_number}
              onChange={(e) => setForm({ ...form, from_number: e.currentTarget.value })}
              required
              placeholder="+1234567890"
            />
          </>
        )}

        <Divider my="md" />

        <TextInput
          label={t('test_phone_number') || 'رقم هاتف للاختبار'}
          value={testPhoneNumber}
          onChange={(e) => setTestPhoneNumber(e.currentTarget.value)}
          placeholder="+1234567890"
        />

        <Group>
          <Button onClick={handleTest} loading={testing} variant="outline">
            {t('test_sms') || 'اختبار SMS'}
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {t('save') || 'حفظ'}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

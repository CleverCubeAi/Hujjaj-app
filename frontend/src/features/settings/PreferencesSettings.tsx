import { useEffect, useState } from 'react';
import {
  Paper,
  Stack,
  Select,
  Button,
  Title,
  Switch,
  LoadingOverlay
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../providers/AuthProvider';

export function PreferencesSettings() {
  const { t, i18n } = useTranslation();
  const { user: _user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    language: 'ar',
    theme: 'light',
    notifications_email: true,
    notifications_sms: false
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const data = await api.getPreferences();
      setPreferences(data);
      // Update language if changed
      if (data.language && data.language !== i18n.language) {
        i18n.changeLanguage(data.language);
      }
    } catch (error: any) {
      // If preferences don't exist, use defaults
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api.updatePreferences(preferences);
      setPreferences(data);
      
      // Update language immediately
      if (data.language && data.language !== i18n.language) {
        i18n.changeLanguage(data.language);
      }

      notifications.show({
        title: t('success') || 'نجاح',
        message: t('preferences_updated') || 'تم تحديث التفضيلات بنجاح',
        color: 'green'
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to update preferences',
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
        {t('preferences') || 'التفضيلات'}
      </Title>

      <Stack gap="md" mt="md">
        <Select
          label={t('language') || 'اللغة'}
          value={preferences.language}
          onChange={(value) => setPreferences({ ...preferences, language: value || 'ar' })}
          data={[
            { value: 'ar', label: t('arabic') || 'العربية' },
            { value: 'fr', label: t('french') || 'Français' }
          ]}
        />

        <Select
          label={t('theme') || 'المظهر'}
          value={preferences.theme}
          onChange={(value) => setPreferences({ ...preferences, theme: value || 'light' })}
          data={[
            { value: 'light', label: t('light') || 'فاتح' },
            { value: 'dark', label: t('dark') || 'داكن' }
          ]}
        />

        <Switch
          label={t('email_notifications') || 'إشعارات البريد الإلكتروني'}
          checked={preferences.notifications_email}
          onChange={(e) => setPreferences({ ...preferences, notifications_email: e.currentTarget.checked })}
        />

        <Switch
          label={t('sms_notifications') || 'إشعارات الرسائل النصية'}
          checked={preferences.notifications_sms}
          onChange={(e) => setPreferences({ ...preferences, notifications_sms: e.currentTarget.checked })}
        />

        <Button onClick={handleSave} loading={saving} mt="md">
          {t('save') || 'حفظ'}
        </Button>
      </Stack>
    </Paper>
  );
}

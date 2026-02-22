import React, { useEffect, useState } from 'react';
import {
  Paper,
  Stack,
  PasswordInput,
  Button,
  Title,
  Text,
  Alert,
  Badge,
  Group,
  LoadingOverlay
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { Shield, AlertTriangle, Check } from 'lucide-react';

interface DeletionPasswordStatus {
  has_deletion_password: boolean;
  updated_at: string | null;
}

export function SecuritySettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<DeletionPasswordStatus | null>(null);
  const [form, setForm] = useState({
    current_password: '',
    password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await api.getDeletionPasswordStatus();
      setStatus(data);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load security settings',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDeletionPassword = async () => {
    if (form.password !== form.confirm_password) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('passwords_not_match') || 'كلمات المرور غير متطابقة',
        color: 'red'
      });
      return;
    }

    if (form.password.length < 4) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('deletion_password_min_length') || 'كلمة مرور الحذف يجب أن تكون 4 أحرف على الأقل',
        color: 'red'
      });
      return;
    }

    // If user already has a deletion password, require current password
    if (status?.has_deletion_password && !form.current_password) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('current_deletion_password_required') || 'كلمة مرور الحذف الحالية مطلوبة',
        color: 'red'
      });
      return;
    }

    setSaving(true);
    try {
      await api.setDeletionPassword({
        password: form.password,
        current_password: status?.has_deletion_password ? form.current_password : undefined
      });
      
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('deletion_password_set') || 'تم تعيين كلمة مرور الحذف بنجاح',
        color: 'green'
      });
      
      setForm({
        current_password: '',
        password: '',
        confirm_password: ''
      });
      
      fetchStatus();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to set deletion password',
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
      <Group mb="md">
        <Shield size={24} />
        <Title order={3}>
          {t('security_settings') || 'إعدادات الأمان'}
        </Title>
      </Group>

      <Alert 
        icon={<AlertTriangle size={16} />} 
        color="orange" 
        mb="xl"
      >
        <Text size="sm">
          {t('deletion_password_info') || 'كلمة مرور الحذف مطلوبة لحذف الحجوزات. هذه كلمة مرور منفصلة عن كلمة مرور الدخول للحماية الإضافية.'}
        </Text>
      </Alert>

      <Stack gap="lg">
        <div>
          <Group gap="sm" mb="md">
            <Text fw={600}>{t('deletion_password_status') || 'حالة كلمة مرور الحذف'}</Text>
            {status?.has_deletion_password ? (
              <Badge color="green" leftSection={<Check size={12} />}>
                {t('configured') || 'مُعدّة'}
              </Badge>
            ) : (
              <Badge color="red">
                {t('not_configured') || 'غير مُعدّة'}
              </Badge>
            )}
          </Group>
          
          {status?.updated_at && (
            <Text size="sm" c="dimmed">
              {t('last_updated') || 'آخر تحديث'}: {new Date(status.updated_at).toLocaleDateString('en')}
            </Text>
          )}
        </div>

        <Title order={4}>
          {status?.has_deletion_password 
            ? (t('change_deletion_password') || 'تغيير كلمة مرور الحذف')
            : (t('set_deletion_password') || 'تعيين كلمة مرور الحذف')
          }
        </Title>

        <Stack gap="md">
          {status?.has_deletion_password && (
            <PasswordInput
              label={t('current_deletion_password') || 'كلمة مرور الحذف الحالية'}
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.currentTarget.value })}
              required
            />
          )}

          <PasswordInput
            label={t('new_deletion_password') || 'كلمة مرور الحذف الجديدة'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
            description={t('deletion_password_hint') || 'على الأقل 4 أحرف. يُفضل استخدام كلمة سهلة التذكر.'}
            required
          />

          <PasswordInput
            label={t('confirm_deletion_password') || 'تأكيد كلمة مرور الحذف'}
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.currentTarget.value })}
            required
          />

          <Button 
            onClick={handleSetDeletionPassword} 
            loading={saving} 
            mt="md"
            color="orange"
            leftSection={<Shield size={16} />}
          >
            {status?.has_deletion_password 
              ? (t('update_deletion_password') || 'تحديث كلمة مرور الحذف')
              : (t('set_deletion_password') || 'تعيين كلمة مرور الحذف')
            }
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

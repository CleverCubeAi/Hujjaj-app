import { useEffect, useState } from 'react';
import {
  Paper,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Divider,
  LoadingOverlay
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../providers/AuthProvider';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export function ProfileSettings() {
  const { t } = useTranslation();
  const { user: _user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    email: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getProfile();
      setProfile(data);
      setForm({
        full_name: data.full_name || '',
        email: data.email || ''
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load profile',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const data = await api.updateProfile(form);
      setProfile(data);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('profile_updated') || 'تم تحديث الملف الشخصي بنجاح',
        color: 'green'
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to update profile',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('passwords_not_match') || 'كلمات المرور غير متطابقة',
        color: 'red'
      });
      return;
    }

    if (passwordForm.new_password.length < 8) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('password_min_length') || 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
        color: 'red'
      });
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('password_changed') || 'تم تغيير كلمة المرور بنجاح',
        color: 'green'
      });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to change password',
        color: 'red'
      });
    } finally {
      setChangingPassword(false);
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
        {t('profile_settings') || 'إعدادات الملف الشخصي'}
      </Title>

      <Stack gap="md" mt="md">
        <TextInput
          label={t('full_name') || 'الاسم الكامل'}
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.currentTarget.value })}
          required
        />

        <TextInput
          label={t('email') || 'البريد الإلكتروني'}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
          required
          type="email"
        />

        <TextInput
          label={t('role') || 'الدور'}
          value={profile?.role || ''}
          disabled
        />

        <Button onClick={handleSaveProfile} loading={saving} mt="md">
          {t('save') || 'حفظ'}
        </Button>
      </Stack>

      <Divider my="xl" />

      <Title order={4} mb="md">
        {t('change_password') || 'تغيير كلمة المرور'}
      </Title>

      <Stack gap="md" mt="md">
        <PasswordInput
          label={t('current_password') || 'كلمة المرور الحالية'}
          value={passwordForm.current_password}
          onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.currentTarget.value })}
          required
        />

        <PasswordInput
          label={t('new_password') || 'كلمة المرور الجديدة'}
          value={passwordForm.new_password}
          onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.currentTarget.value })}
          required
        />

        <PasswordInput
          label={t('confirm_password') || 'تأكيد كلمة المرور'}
          value={passwordForm.confirm_password}
          onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.currentTarget.value })}
          required
        />

        <Button onClick={handleChangePassword} loading={changingPassword} mt="md">
          {t('change_password') || 'تغيير كلمة المرور'}
        </Button>
      </Stack>
    </Paper>
  );
}

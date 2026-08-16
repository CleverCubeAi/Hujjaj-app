import { useEffect, useState } from 'react';
import {
  Paper, Stack, Select, TextInput, PasswordInput, Button, Title, Group, Switch, Text, NumberInput,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';

const PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
};

export function PlatformEmailSettings() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [form, setForm] = useState({
    provider: 'custom',
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    enabled: false,
    password_configured: false,
    test_status: null as string | null,
    last_tested_at: null as string | null,
  });

  useEffect(() => {
    api.getPlatformEmail().then((data) => {
      setForm((f) => ({
        ...f,
        ...data,
        password: '',
        port: data.port || 587,
      }));
    }).catch(() => undefined);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api.updatePlatformEmail({ ...form, password: form.password || undefined });
      setForm((f) => ({ ...f, ...data, password: '' }));
      notifications.show({ title: t('success'), message: t('email_saved') || 'Saved', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await api.testPlatformEmail(testTo);
      notifications.show({ title: t('success'), message: t('test_email_sent') || 'Sent', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Paper p="xl">
      <Title order={3} mb="xs">{t('platform_email') || 'بريد المنصة'}</Title>
      <Text size="sm" c="dimmed" mb="md">
        {t('platform_email_help') || 'Used for subscription and account emails, not for agencies’ clients.'}
      </Text>
      <Stack>
        <Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })} label={t('enabled') || 'مفعّل'} />
        <Select
          label={t('provider')}
          value={form.provider}
          data={['gmail', 'outlook', 'yahoo', 'custom'].map((v) => ({ value: v, label: v }))}
          onChange={(v) => {
            const preset = v && PRESETS[v];
            setForm({
              ...form,
              provider: v || 'custom',
              ...(preset || {}),
            });
          }}
        />
        <TextInput label={t('smtp_host')} value={form.host} onChange={(e) => setForm({ ...form, host: e.currentTarget.value })} />
        <NumberInput label={t('smtp_port') || 'Port'} value={form.port} onChange={(v) => setForm({ ...form, port: Number(v || 587) })} />
        <Switch checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.currentTarget.checked })} label="TLS/SSL" />
        <TextInput label={t('username')} value={form.username} onChange={(e) => setForm({ ...form, username: e.currentTarget.value })} />
        <PasswordInput
          label={t('password')}
          placeholder={form.password_configured ? t('unchanged') || 'unchanged' : ''}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
        />
        <TextInput label={t('from_email')} value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.currentTarget.value })} />
        <TextInput label={t('from_name')} value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.currentTarget.value })} />
        {form.test_status && (
          <Text size="sm" c={form.test_status === 'success' ? 'green' : 'red'}>
            {form.test_status} {form.last_tested_at ? `· ${form.last_tested_at}` : ''}
          </Text>
        )}
        <Button color="teal" loading={saving} onClick={save}>{t('save')}</Button>
        <Group>
          <TextInput placeholder={t('test_email') || 'email@example.com'} value={testTo} onChange={(e) => setTestTo(e.currentTarget.value)} style={{ flex: 1 }} />
          <Button variant="light" loading={testing} onClick={test}>{t('send_test') || 'Test'}</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

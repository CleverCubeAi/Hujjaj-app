import { useEffect, useState } from 'react';
import {
  Paper, Stack, Select, TextInput, PasswordInput, Button, Title, Switch, NumberInput, Text, Group, Progress,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';

export function LlmSettings() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [form, setForm] = useState({
    enabled: false,
    provider: 'openai',
    api_key: '',
    key_configured: false,
    base_url: '',
    api_version: '',
    default_model: 'gpt-4.1-mini',
    timeout_ms: 30000,
    max_tokens: 1024,
    monthly_budget_usd: '' as string | number,
    budget_alert_email: '',
  });

  useEffect(() => {
    api.getPlatformLlm().then((data) => {
      setForm((f) => ({
        ...f,
        ...data,
        api_key: '',
        monthly_budget_usd: data.monthly_budget_usd ?? '',
      }));
    }).catch(() => undefined);
    api.getPlatformLlmUsage().then(setUsage).catch(() => undefined);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form, api_key: form.api_key || undefined };
      if (payload.monthly_budget_usd === '') payload.monthly_budget_usd = null;
      const data = await api.updatePlatformLlm(payload);
      setForm((f) => ({ ...f, ...data, api_key: '' }));
      notifications.show({ title: t('success'), message: t('saved') || 'Saved', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await api.testPlatformLlm();
      notifications.show({
        title: result.ok ? t('success') : t('error'),
        message: result.ok ? `${result.model} · ${result.latency_ms}ms` : result.error,
        color: result.ok ? 'green' : 'red',
      });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    } finally {
      setTesting(false);
    }
  };

  const budget = Number(usage?.monthly_budget_usd || 0);
  const spent = Number(usage?.month_spend_usd || 0);

  return (
    <Paper p="xl">
      <Title order={3} mb="md">{t('llm_settings') || 'LLM'}</Title>
      <Stack>
        <Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })} label={t('enabled') || 'مفعّل'} />
        <Select
          label={t('provider')}
          value={form.provider}
          data={['openai', 'anthropic', 'azure_openai', 'google', 'custom'].map((v) => ({ value: v, label: v }))}
          onChange={(v) => setForm({ ...form, provider: v || 'openai' })}
        />
        {(form.provider === 'azure_openai' || form.provider === 'custom') && (
          <TextInput label="Base URL" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.currentTarget.value })} />
        )}
        {form.provider === 'azure_openai' && (
          <TextInput label="API version" value={form.api_version} onChange={(e) => setForm({ ...form, api_version: e.currentTarget.value })} />
        )}
        <PasswordInput
          label="API key"
          placeholder={form.key_configured ? t('unchanged') || 'unchanged' : ''}
          value={form.api_key}
          onChange={(e) => setForm({ ...form, api_key: e.currentTarget.value })}
        />
        <TextInput label={t('default_model') || 'النموذج'} value={form.default_model} onChange={(e) => setForm({ ...form, default_model: e.currentTarget.value })} />
        <NumberInput label="Max tokens" value={form.max_tokens} onChange={(v) => setForm({ ...form, max_tokens: Number(v || 1024) })} />
        <NumberInput label="Timeout (ms)" value={form.timeout_ms} onChange={(v) => setForm({ ...form, timeout_ms: Number(v || 30000) })} />
        <NumberInput label={t('monthly_budget_usd') || 'ميزانية شهرية USD'} value={form.monthly_budget_usd as number} onChange={(v) => setForm({ ...form, monthly_budget_usd: v === '' ? '' : Number(v) })} />
        <TextInput label={t('budget_alert_email') || 'بريد التنبيه'} value={form.budget_alert_email} onChange={(e) => setForm({ ...form, budget_alert_email: e.currentTarget.value })} />
        <Group>
          <Button color="brown" loading={saving} onClick={save}>{t('save')}</Button>
          <Button variant="light" loading={testing} onClick={test}>{t('test_connection') || 'Test'}</Button>
        </Group>
        {budget > 0 && (
          <div>
            <Text size="sm">{spent.toFixed(4)} / {budget} USD</Text>
            <Progress value={Math.min(100, (spent / budget) * 100)} color="brown" />
          </div>
        )}
      </Stack>
    </Paper>
  );
}

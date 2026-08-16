import { useEffect, useState } from 'react';
import {
  Paper, Stack, TextInput, PasswordInput, Button, Title, Switch, Text, SimpleGrid, Alert,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';

type Gateway = {
  provider: string;
  enabled: boolean;
  public_key?: string;
  sandbox: boolean;
  extra?: any;
  secret_configured: boolean;
  webhook_secret_configured: boolean;
  webhook_url?: string | null;
};

export function PaymentGatewaySettings() {
  const { t } = useTranslation();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [forms, setForms] = useState<Record<string, any>>({});

  const load = async () => {
    const rows = await api.getPlatformGateways();
    setGateways(rows);
    const next: Record<string, any> = {};
    for (const g of rows) {
      next[g.provider] = {
        enabled: g.enabled,
        public_key: g.public_key || '',
        secret_key: '',
        webhook_secret: '',
        sandbox: g.sandbox,
        storeKey: g.extra?.storeKey || g.extra?.store_key || '',
      };
    }
    setForms(next);
  };

  useEffect(() => { load().catch(() => undefined); }, []);

  const enabledCards = gateways.filter((g) => g.enabled && g.provider !== 'manual').map((g) => g.provider);

  const save = async (provider: string) => {
    try {
      const f = forms[provider];
      await api.updatePlatformGateway(provider, {
        enabled: f.enabled,
        public_key: f.public_key,
        secret_key: f.secret_key || undefined,
        webhook_secret: f.webhook_secret || undefined,
        sandbox: f.sandbox,
        extra: provider === 'cmi' ? { storeKey: f.storeKey } : {},
      });
      notifications.show({ title: t('success'), message: t('saved') || 'Saved', color: 'green' });
      load();
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    }
  };

  const test = async (provider: string) => {
    try {
      const result = await api.testPlatformGateway(provider);
      notifications.show({
        title: result.ok ? t('success') : t('error'),
        message: result.message || result.error,
        color: result.ok ? 'green' : 'red',
      });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    }
  };

  return (
    <Stack>
      {enabledCards.length > 1 && (
        <Alert color="yellow">{t('one_card_gateway') || 'Only the first enabled non-manual provider is used for checkout.'}</Alert>
      )}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {gateways.map((g) => {
          const f = forms[g.provider] || {};
          return (
            <Paper p="lg" key={g.provider}>
              <Title order={4} mb="sm">{g.provider.toUpperCase()}</Title>
              <Stack>
                <Switch
                  checked={!!f.enabled}
                  disabled={g.provider === 'manual'}
                  onChange={(e) => setForms({ ...forms, [g.provider]: { ...f, enabled: e.currentTarget.checked } })}
                  label={t('enabled') || 'مفعّل'}
                />
                {g.provider !== 'manual' && (
                  <>
                    <Switch
                      checked={!!f.sandbox}
                      onChange={(e) => setForms({ ...forms, [g.provider]: { ...f, sandbox: e.currentTarget.checked } })}
                      label="Sandbox"
                    />
                    <TextInput
                      label={g.provider === 'cmi' ? 'Merchant ID' : 'Publishable key'}
                      value={f.public_key || ''}
                      onChange={(e) => setForms({ ...forms, [g.provider]: { ...f, public_key: e.currentTarget.value } })}
                    />
                    <PasswordInput
                      label="Secret"
                      placeholder={g.secret_configured ? t('unchanged') || 'unchanged' : ''}
                      value={f.secret_key || ''}
                      onChange={(e) => setForms({ ...forms, [g.provider]: { ...f, secret_key: e.currentTarget.value } })}
                    />
                    {g.provider === 'stripe' && (
                      <PasswordInput
                        label="Webhook secret"
                        placeholder={g.webhook_secret_configured ? t('unchanged') || 'unchanged' : ''}
                        value={f.webhook_secret || ''}
                        onChange={(e) => setForms({ ...forms, [g.provider]: { ...f, webhook_secret: e.currentTarget.value } })}
                      />
                    )}
                    {g.provider === 'cmi' && (
                      <PasswordInput
                        label="Store key"
                        value={f.storeKey || ''}
                        onChange={(e) => setForms({ ...forms, [g.provider]: { ...f, storeKey: e.currentTarget.value } })}
                      />
                    )}
                    {g.webhook_url && <Text size="xs" c="dimmed">{g.webhook_url}</Text>}
                  </>
                )}
                <Button color="brown" onClick={() => save(g.provider)}>{t('save')}</Button>
                <Button variant="light" onClick={() => test(g.provider)}>{t('test_connection') || 'Test'}</Button>
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

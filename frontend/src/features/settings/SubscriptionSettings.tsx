import { useEffect, useState } from 'react';
import { Paper, Stack, Title, Text, Button, SimpleGrid, Badge, Table, Alert, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';

export function SubscriptionSettings() {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const [sub, setSub] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const load = async () => {
    const [s, pkgs, inv] = await Promise.all([
      api.getSubscription(),
      api.getPublicPackages(),
      api.getBillingInvoices().catch(() => []),
    ]);
    setSub(s);
    setCatalog(pkgs);
    setInvoices(inv);
  };

  useEffect(() => { load().catch(() => undefined); }, []);
  useEffect(() => {
    if (params.get('billing') === 'success') {
      notifications.show({ title: t('success'), message: t('payment_success') || 'Payment received', color: 'green' });
    }
  }, [params]);

  const pay = async (packageId: string) => {
    try {
      const result = await api.checkoutSubscription(packageId);
      if (result.checkout_url) window.location.href = result.checkout_url;
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    }
  };

  const pkgName = i18n.language === 'fr' ? sub?.package?.name_fr : sub?.package?.name_ar;

  return (
    <Stack>
      {sub?.status === 'past_due' && (
        <Alert color="red">{t('subscription_past_due') || 'Subscription is past due.'}</Alert>
      )}
      <Paper p="xl">
        <Title order={3} mb="sm">{t('current_plan') || 'الخطة الحالية'}</Title>
        <Group>
          <Text fw={700}>{pkgName || sub?.package?.slug}</Text>
          <Badge>{sub?.status}</Badge>
        </Group>
        {sub?.renews_at && <Text size="sm" c="dimmed">{t('renews_at') || 'تجديد'}: {new Date(sub.renews_at).toLocaleDateString()}</Text>}
      </Paper>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {catalog.map((pkg) => (
          <Paper p="lg" key={pkg.id} withBorder>
            <Title order={4}>{i18n.language === 'fr' ? pkg.name_fr : pkg.name_ar}</Title>
            <Text fw={700} my="sm">{Number(pkg.price_amount).toLocaleString()} {pkg.currency} / {pkg.billing_period}</Text>
            <Button
              color="brown"
              fullWidth
              disabled={sub?.package?.id === pkg.id}
              onClick={() => pay(pkg.id)}
            >
              {Number(pkg.price_amount) === 0 ? (t('select') || 'اختيار') : (t('pay') || 'دفع')}
            </Button>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper p="xl">
        <Title order={4} mb="md">{t('invoices') || 'الفواتير'}</Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>{t('amount')}</Table.Th>
              <Table.Th>{t('status')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.number}</Table.Td>
                <Table.Td>{Number(row.amount).toLocaleString()} {row.currency}</Table.Td>
                <Table.Td><Badge>{row.status}</Badge></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

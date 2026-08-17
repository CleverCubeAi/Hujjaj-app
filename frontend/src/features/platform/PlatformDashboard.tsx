import { useEffect, useState } from 'react';
import { SimpleGrid, Paper, Text, Group, Title, Stack, Box, ThemeIcon, Badge, Table, Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, ShieldCheck, Ban, CreditCard } from 'lucide-react';
import { api } from '../../lib/api';
import { formatLocalDate } from '../../lib/dates';

interface PlatformDashboardData {
  agencies: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
        byPlan: Record<string, number>;
  };
  users: { total: number };
  recentAgencies: Array<{
    id: string;
    name: string;
    country?: string | null;
    status: string;
    subscription_plan: string;
    created_at: string;
  }>;
}

function StatCard({
  title,
  value,
  icon,
  color = 'teal',
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        backgroundColor: '#F8F6F0',
        border: '1px solid #E2D9C8',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <Group justify="space-between">
        <Box>
          <Text size="sm" c="dimmed" fw={500}>{title}</Text>
          <Text size="xl" fw={700} mt={4}>{value}</Text>
        </Box>
        <ThemeIcon size={50} radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

function statusColor(status: string) {
  if (status === 'active') return 'green';
  if (status === 'suspended') return 'red';
  return 'gray';
}

function planColor(plan: string) {
  if (plan === 'premium') return 'gold';
  if (plan === 'basic') return 'teal';
  return 'gray';
}

export function PlatformDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<PlatformDashboardData | null>(null);

  useEffect(() => {
    api.getPlatformDashboard()
      .then(setData)
      .catch((error) => console.error('Error fetching platform dashboard:', error));
  }, []);

  const agencies = data?.agencies;
  const fmt = (n?: number) => (Number.isFinite(n) ? Number(n) : 0).toLocaleString('en');

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Box>
          <Title order={1} fw={700} c="#071D35">
            {t('platform_dashboard') || 'لوحة المنصة'}
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            {t('platform_dashboard_subtitle') || 'إدارة حسابات الوكالات واشتراكاتها'}
          </Text>
        </Box>
        <Badge size="lg" variant="light" color="teal" radius="md">
          {t('super_admin') || 'مدير المنصة'}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        <StatCard
          title={t('total_agencies') || 'الوكالات'}
          value={fmt(agencies?.total)}
          icon={<Building2 size={24} />}
          color="teal"
        />
        <StatCard
          title={t('active_agencies') || 'وكالات نشطة'}
          value={fmt(agencies?.active)}
          icon={<ShieldCheck size={24} />}
          color="green"
        />
        <StatCard
          title={t('suspended_agencies') || 'وكالات معلقة'}
          value={fmt(agencies?.suspended)}
          icon={<Ban size={24} />}
          color="red"
        />
        <StatCard
          title={t('agency_users') || 'مستخدمو الوكالات'}
          value={fmt(data?.users.total)}
          icon={<Users size={24} />}
          color="teal"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        {Object.entries(agencies?.byPlan || {}).map(([slug, count]) => (
          <StatCard
            key={slug}
            title={slug}
            value={fmt(count as number)}
            icon={<CreditCard size={22} />}
            color="teal"
          />
        ))}
      </SimpleGrid>

      <Paper p="lg" radius="lg" style={{ backgroundColor: '#F8F6F0', border: '1px solid #E2D9C8' }}>
        <Group justify="space-between" mb="md">
          <Title order={4}>{t('recent_agencies') || 'أحدث الوكالات'}</Title>
          <Button variant="subtle" color="teal" onClick={() => navigate('/agencies')}>
            {t('view_all') || 'عرض الكل'}
          </Button>
        </Group>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('agency_name') || 'اسم الوكالة'}</Table.Th>
              <Table.Th>{t('country') || 'البلد'}</Table.Th>
              <Table.Th>{t('subscription_plan') || 'خطة الاشتراك'}</Table.Th>
              <Table.Th>{t('status') || 'الحالة'}</Table.Th>
              <Table.Th>{t('created_at') || 'تاريخ الإنشاء'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(data?.recentAgencies || []).length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md">{t('no_data') || 'لا توجد بيانات'}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              (data?.recentAgencies || []).map((agency) => (
                <Table.Tr
                  key={agency.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/agencies/${agency.id}`)}
                >
                  <Table.Td fw={500}>{agency.name}</Table.Td>
                  <Table.Td>{agency.country || '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={planColor(agency.subscription_plan)}>
                      {t(agency.subscription_plan) || agency.subscription_plan}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={statusColor(agency.status)}>
                      {t(agency.status) || agency.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatLocalDate(agency.created_at)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

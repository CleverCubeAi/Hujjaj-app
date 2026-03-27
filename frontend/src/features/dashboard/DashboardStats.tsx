import { useEffect, useState } from 'react';
import { SimpleGrid, Paper, Text, Group, RingProgress, Card, Title, Stack, Box, ThemeIcon, Progress, Badge, Alert } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Users, CreditCard, TrendingUp, TrendingDown, CalendarDays, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../providers/AuthProvider';

interface DashboardData {
  pilgrims: { total: number; male: number; female: number };
  bookings: { total: number; draft: number; confirmed: number; paid: number; cancelled: number };
  financial: { totalAgreed: number; totalPaid: number; totalRemaining: number; paymentPercentage: number };
  recentBookings: any[];
  accommodations: any[];
  flightsCount: number;
  inventory: {
    hotel: { totalBeds: number; soldBeds: number; availableBeds: number };
    flight: { totalSeats: number; soldSeats: number; availableSeats: number };
  };
  userRole: string;
  isFiltered: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: string;
}

function StatCard({ title, value, icon, trend, trendUp, color = 'brown' }: StatCardProps) {
  return (
    <Paper 
      p="lg" 
      radius="lg" 
      style={{ 
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8DFD0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}
    >
      <Group justify="space-between" mb="md">
        <Box>
          <Text size="sm" c="dimmed" fw={500}>{title}</Text>
          <Text size="xl" fw={700} mt={4}>{value}</Text>
        </Box>
        <ThemeIcon size={50} radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
      {trend && (
        <Group gap={4}>
          {trendUp ? (
            <TrendingUp size={14} color="#66BB6A" />
          ) : (
            <TrendingDown size={14} color="#EF5350" />
          )}
          <Text size="xs" c={trendUp ? 'green' : 'red'} fw={500}>
            {trend}
          </Text>
          <Text size="xs" c="dimmed">من الشهر الماضي</Text>
        </Group>
      )}
    </Paper>
  );
}

export function DashboardStats() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [data, setData] = useState<DashboardData>({
    pilgrims: { total: 0, male: 0, female: 0 },
    bookings: { total: 0, draft: 0, confirmed: 0, paid: 0, cancelled: 0 },
    financial: { totalAgreed: 0, totalPaid: 0, totalRemaining: 0, paymentPercentage: 0 },
    recentBookings: [],
    accommodations: [],
    flightsCount: 0,
    inventory: {
      hotel: { totalBeds: 0, soldBeds: 0, availableBeds: 0 },
      flight: { totalSeats: 0, soldSeats: 0, availableSeats: 0 }
    },
    userRole: '',
    isFiltered: false
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const dashboardData = await api.getDashboardStats();
        setData(dashboardData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        // loading handled via data
      }
    };

    fetchDashboardData();
  }, []);

  const paymentPercentage = data.financial.paymentPercentage;

  const getRoleLabel = () => {
    if (role === 'agent') return t('agent') || 'وكيل';
    if (role === 'manager') return t('manager') || 'مدير';
    return t('agency_admin') || 'مدير الوكالة';
  };

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Box>
          <Title order={1} fw={700} c="#2D2D2D">{t('dashboard') || 'الرئيسية'}</Title>
          <Text size="sm" c="dimmed" mt={4}>
            {data.isFiltered ? (
              role === 'agent' 
                ? (t('showing_your_data') || 'عرض بياناتك الخاصة')
                : (t('showing_branch_data') || 'عرض بيانات فرعك')
            ) : (t('showing_all_data') || 'عرض جميع بيانات الوكالة')}
          </Text>
        </Box>
        <Badge size="lg" variant="light" color="brown" radius="md">
          <Group gap={6}>
            <Users size={14} />
            {getRoleLabel()}
          </Group>
        </Badge>
      </Group>

      {data.isFiltered && (
        <Alert icon={<Info size={16} />} color="blue" variant="light">
          {role === 'agent' 
            ? (t('agent_dashboard_info') || 'أنت ترى بيانات الحجوزات التي أنشأتها فقط.')
            : (t('manager_dashboard_info') || 'أنت ترى بيانات الحجوزات من فرعك فقط.')
          }
        </Alert>
      )}
      
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        <StatCard
          title={t('total_pilgrims') || 'مجموع المعتمرين'}
          value={data.pilgrims.total.toLocaleString('en')}
          icon={<Users size={24} />}
          color="blue"
        />
        
        <StatCard
          title={t('bookings_count') || 'عدد الحجوزات'}
          value={data.bookings.total.toLocaleString('en')}
          icon={<CalendarDays size={24} />}
          color="orange"
        />

        <StatCard
          title={t('total_received') || 'المبالغ المستلمة'}
          value={`${data.financial.totalPaid.toLocaleString('en')} MAD`}
          icon={<CreditCard size={24} />}
          color="green"
        />

        <StatCard
          title={t('total_pending') || 'المبالغ المتبقية'}
          value={`${data.financial.totalRemaining.toLocaleString('en')} MAD`}
          icon={<CreditCard size={24} />}
          color={data.financial.totalRemaining > 0 ? 'red' : 'green'}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        {/* Payment Progress */}
        <Card 
          padding="xl" 
          radius="lg"
          style={{ 
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8DFD0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <Group justify="space-between" mb="lg">
            <Text fw={600} size="lg">{t('bookings_by_status') || 'الحجوزات حسب الحالة'}</Text>
            <ThemeIcon size={36} radius="md" variant="light" color="brown">
              <CalendarDays size={20} />
            </ThemeIcon>
          </Group>
          <Box style={{ textAlign: 'center' }} mb="xl">
            <RingProgress 
              size={180} 
              roundCaps 
              thickness={16}
              sections={[
                { value: data.bookings.total > 0 ? (data.bookings.confirmed / data.bookings.total) * 100 : 0, color: '#4CAF50' },
                { value: data.bookings.total > 0 ? (data.bookings.paid / data.bookings.total) * 100 : 0, color: '#2196F3' },
                { value: data.bookings.total > 0 ? (data.bookings.draft / data.bookings.total) * 100 : 0, color: '#9E9E9E' },
                { value: data.bookings.total > 0 ? (data.bookings.cancelled / data.bookings.total) * 100 : 0, color: '#f44336' }
              ]}
              label={
                <Box style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>{t('total') || 'المجموع'}</Text>
                  <Text size="xl" fw={700}>{data.bookings.total}</Text>
                </Box>
              }
            />
          </Box>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Box w={8} h={8} style={{ borderRadius: 2, backgroundColor: '#4CAF50' }} />
                <Text size="sm" c="dimmed">{t('confirmed') || 'مؤكد'}</Text>
              </Group>
              <Text fw={600} size="sm">{data.bookings.confirmed}</Text>
            </Group>
            <Group justify="space-between">
              <Group gap="xs">
                <Box w={8} h={8} style={{ borderRadius: 2, backgroundColor: '#2196F3' }} />
                <Text size="sm" c="dimmed">{t('paid') || 'مدفوع'}</Text>
              </Group>
              <Text fw={600} size="sm">{data.bookings.paid}</Text>
            </Group>
            <Group justify="space-between">
              <Group gap="xs">
                <Box w={8} h={8} style={{ borderRadius: 2, backgroundColor: '#9E9E9E' }} />
                <Text size="sm" c="dimmed">{t('draft') || 'مسودة'}</Text>
              </Group>
              <Text fw={600} size="sm">{data.bookings.draft}</Text>
            </Group>
          </Stack>
        </Card>

        {/* Financial Summary */}
        <Card 
          padding="xl" 
          radius="lg"
          style={{ 
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8DFD0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <Group justify="space-between" mb="lg">
            <Text fw={600} size="lg">{t('financial_summary') || 'الملخص المالي'}</Text>
            <Badge variant="light" color="brown" size="sm">{paymentPercentage}%</Badge>
          </Group>
          <Text size="32px" fw={700} mb="xs">{data.financial.totalAgreed.toLocaleString('en')}</Text>
          <Text size="sm" c="dimmed" mb="xl">
            {t('total_revenue') || 'إجمالي الإيرادات'} (MAD)
          </Text>
          <Stack gap="md">
            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">{t('total_revenue') || 'المتفق عليه'}</Text>
                <Text size="xs" fw={600}>{data.financial.totalAgreed.toLocaleString('en')} MAD</Text>
              </Group>
              <Progress value={100} color="brown" size="sm" radius="xl" />
            </Box>
            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">{t('total_received') || 'المدفوع'}</Text>
                <Text size="xs" fw={600} c="green">{data.financial.totalPaid.toLocaleString('en')} MAD</Text>
              </Group>
              <Progress value={paymentPercentage} color="green" size="sm" radius="xl" />
            </Box>
            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">{t('total_pending') || 'المتبقي'}</Text>
                <Text size="xs" fw={600} c="red">{data.financial.totalRemaining.toLocaleString('en')} MAD</Text>
              </Group>
              <Progress value={100 - paymentPercentage} color="red" size="sm" radius="xl" />
            </Box>
          </Stack>
        </Card>

        {/* Summary Stats */}
        <Card 
          padding="xl" 
          radius="lg"
          style={{ 
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8DFD0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <Group justify="space-between" mb="lg">
            <Text fw={600} size="lg">{t('pilgrims_by_status') || 'المعتمرين'}</Text>
          </Group>
          <Stack gap="lg">
            <Box>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <ThemeIcon size="sm" radius="xl" variant="light" color="teal">
                    <Users size={12} />
                  </ThemeIcon>
                  <Text size="sm">{t('male') || 'ذكر'}</Text>
                </Group>
                <Text fw={600} size="sm">{data.pilgrims.male}</Text>
              </Group>
              <Group gap={6}>
                <Text size="xs" c="teal" fw={500}>
                  {data.pilgrims.total > 0 ? Math.round((data.pilgrims.male / data.pilgrims.total) * 100) : 0}%
                </Text>
              </Group>
            </Box>
            
            <Box>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <ThemeIcon size="sm" radius="xl" variant="light" color="pink">
                    <Users size={12} />
                  </ThemeIcon>
                  <Text size="sm">{t('female') || 'أنثى'}</Text>
                </Group>
                <Text fw={600} size="sm">{data.pilgrims.female}</Text>
              </Group>
              <Group gap={6}>
                <Text size="xs" c="pink" fw={500}>
                  {data.pilgrims.total > 0 ? Math.round((data.pilgrims.female / data.pilgrims.total) * 100) : 0}%
                </Text>
              </Group>
            </Box>

            <Box p="md" style={{ backgroundColor: '#F5EFE6', borderRadius: 8 }}>
              <Text size="xs" c="dimmed" mb={4}>{t('total_pilgrims') || 'إجمالي المعتمرين'}</Text>
              <Text size="xl" fw={700}>{data.pilgrims.total.toLocaleString('en')}</Text>
            </Box>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Recent Bookings */}
      <Card 
        padding="xl" 
        radius="lg"
        style={{ 
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8DFD0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <Group justify="space-between" mb="lg">
          <Text fw={600} size="lg">{t('recent_bookings') || 'الحجوزات الأخيرة'}</Text>
          <Badge variant="light" color="brown">{data.recentBookings.length} {t('bookings') || 'حجوزات'}</Badge>
        </Group>
        <Stack gap="md">
          {data.recentBookings.map((booking: any, idx: number) => (
            <Group key={booking.id} justify="space-between" p="md" style={{ borderBottom: idx < data.recentBookings.length - 1 ? '1px solid #E8DFD0' : 'none' }}>
              <Group>
                <Badge 
                  color={
                    booking.status === 'paid' ? 'green' : 
                    booking.status === 'confirmed' ? 'blue' : 
                    booking.status === 'cancelled' ? 'red' : 'gray'
                  } 
                  variant="light" 
                  size="sm"
                >
                  {booking.status === 'paid' ? (t('paid') || 'مدفوع') : 
                   booking.status === 'confirmed' ? (t('confirmed') || 'مؤكد') :
                   booking.status === 'cancelled' ? (t('cancelled') || 'ملغى') : (t('draft') || 'مسودة')}
                </Badge>
                <Box>
                  <Text size="sm" fw={500}>{booking.booking_number}</Text>
                  <Text size="xs" c="dimmed">{booking.client_name}</Text>
                </Box>
              </Group>
              <Group>
                <Box ta="right">
                  <Text size="sm" fw={500}>{booking.total_amount?.toLocaleString('en')} MAD</Text>
                  <Text size="xs" c="dimmed">{booking.pilgrims_count} {t('pilgrims') || 'معتمرين'}</Text>
                </Box>
                <Text size="xs" c="dimmed">{new Date(booking.created_at).toLocaleDateString('en')}</Text>
              </Group>
            </Group>
          ))}
          {data.recentBookings.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="xl">{t('no_data') || 'لا توجد حجوزات'}</Text>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

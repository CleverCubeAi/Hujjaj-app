import { useEffect, useMemo, useState } from 'react';
import {
  SimpleGrid, Paper, Text, Group, RingProgress, Title, Stack, Box, ThemeIcon, Badge, Alert, UnstyledButton, Grid, Progress,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, TrendingUp, TrendingDown, Info, Plus, UserPlus, MessageSquare, FileText, ChevronLeft, ChevronRight,
  Wallet, AlertCircle, Scale,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { api } from '../../lib/api';
import { useAuth } from '../../providers/AuthProvider';
import { brand, cardStyle } from '../../theme/brand';
import { formatLocalDate } from '../../lib/dates';
import { countries } from '../../data/locations';
import kaabaDay from '../../assets/img/kaaba-day.png';
import welcomeBg from '../../assets/img/welcome-bg.png';
import quoteBg from '../../assets/img/quote-bg.png';
import haramEvening from '../../assets/img/haram-evening.png';

interface DashboardData {
  pilgrims: { total: number; male: number; female: number };
  bookings: { total: number; draft: number; confirmed: number; paid: number; cancelled: number };
  financial: {
    totalAgreed: number;
    totalPaid: number;
    totalRemaining: number;
    paymentPercentage: number;
    totalExpenses?: number;
    totalBedsCost?: number;
    totalFlightsCost?: number;
    totalCosts?: number;
    netPosition?: number;
    inventoryProfit?: number;
    unpaidCount?: number;
  };
  recentBookings: Array<{
    id: string;
    booking_number: string;
    client_name: string;
    total_amount: number;
    status: string;
    pilgrims_count: number;
    created_at: string;
    season_name?: string | null;
    season_type?: string | null;
  }>;
  accommodations: Array<{ id: string; city?: string }>;
  flightsCount: number;
  hotelsCount?: number;
  clientsCount?: number;
  weeklyBookings?: Array<{ date: string; weekday: number; count: number }>;
  monthlyBookings?: Array<{ date: string; count: number }>;
  yearlyBookings?: Array<{ month: string; count: number }>;
  monthlyRevenue?: Array<{ month: string; amount: number }>;
  destinations?: Array<{ name: string; value: number }>;
  upcomingSeasons?: Array<{ id: string; name: string; type: string; start_date?: string; end_date?: string; status?: string }>;
  trends?: { bookings: number | null; revenue: number | null; clients: number | null };
  performance?: {
    week: { total: number; growth: number };
    month: { total: number; growth: number };
    year: { total: number; growth: number };
  };
  seasonRevenue?: { total: number; growth: number };
  inventory: {
    hotel: { totalBeds: number; soldBeds: number; availableBeds: number };
    flight: { totalSeats: number; soldSeats: number; availableSeats: number };
  };
  isFiltered: boolean;
}

const PIE_COLORS = ['url(#pie-grad-0)', 'url(#pie-grad-1)', 'url(#pie-grad-2)', 'url(#pie-grad-3)', brand.navy];
const PIE_LEGEND_COLORS = [brand.teal, brand.gold, brand.tealDeep, brand.goldLight, brand.navy];

type PerformancePeriod = 'week' | 'month' | 'year';

function compactNumber(value: number) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${sign}${abs.toLocaleString('en')}`;
}

function destinationLabel(name: string, lang: string): string {
  const needle = name.trim().toLowerCase();
  for (const country of countries) {
    const city = country.cities.find(
      (c) => c.value === needle || c.label.toLowerCase() === needle,
    );
    if (city) {
      if (lang.startsWith('ar')) return city.label_ar;
      if (lang.startsWith('fr')) return city.label_fr;
      return city.label;
    }
  }
  return name;
}

type KpiTone = 'default' | 'warning' | 'danger' | 'success';

const KPI_TONE: Record<KpiTone, { icon: string; accent: string; bar: string }> = {
  default: { icon: 'teal', accent: brand.teal, bar: 'teal' },
  success: { icon: 'teal', accent: brand.success, bar: 'teal' },
  warning: { icon: 'orange', accent: brand.warning, bar: 'orange' },
  danger: { icon: 'red', accent: brand.danger, bar: 'red' },
};

function KpiCard({
  title,
  value,
  icon,
  trend,
  hint,
  progress,
  tone = 'default',
  to,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number | null;
  hint?: string;
  progress?: number;
  tone?: KpiTone;
  to?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const colors = KPI_TONE[tone];
  const showTrend = trend !== undefined && trend !== null;
  const up = (trend || 0) >= 0;
  const borderAccent = tone === 'default' ? brand.border : colors.accent;

  const body = (
    <Paper
      p="lg"
      radius={20}
      style={{
        ...cardStyle,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: borderAccent,
        borderInlineStartWidth: tone === 'default' ? 1 : 3,
        cursor: to ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      }}
    >
      <ThemeIcon size={44} radius="xl" variant="light" color={colors.icon} mb="md">
        {icon}
      </ThemeIcon>
      <Box style={{ flex: 1 }}>
        <Text size="sm" c={brand.muted} fw={500}>{title}</Text>
        <Text fz={28} fw={700} c={brand.navy} mt={4} lh={1.1}>{value}</Text>
      </Box>
      {hint && (
        <Text size="xs" c={tone === 'default' ? brand.muted : colors.accent} fw={600} mt={8}>
          {hint}
        </Text>
      )}
      {progress !== undefined && (
        <Progress value={Math.max(0, Math.min(100, progress))} color={colors.bar} size="sm" mt={8} radius="xl" />
      )}
      {showTrend && (
        <Group gap={4} mt={8}>
          {up ? <TrendingUp size={14} color={brand.teal} /> : <TrendingDown size={14} color={brand.danger} />}
          <Text size="xs" fw={600} c={up ? brand.teal : brand.danger}>
            {up ? '+' : ''}{trend}%
          </Text>
          <Text size="xs" c={brand.muted}>{t('from_last_month') || 'من الشهر الماضي'}</Text>
        </Group>
      )}
    </Paper>
  );

  if (!to) return body;

  return (
    <UnstyledButton
      onClick={() => navigate(to)}
      aria-label={title}
      style={{ height: '100%', width: '100%', display: 'block', textAlign: 'inherit' }}
    >
      {body}
    </UnstyledButton>
  );
}

function statusBadge(status: string, t: (k: string) => string) {
  if (status === 'paid' || status === 'confirmed') {
    return { color: 'green', label: status === 'paid' ? (t('paid') || 'مدفوع') : (t('confirmed') || 'مؤكد') };
  }
  if (status === 'draft' || status === 'pending') {
    return { color: 'yellow', label: t('draft') || 'مسودة' };
  }
  if (status === 'cancelled' || status === 'expired') {
    return { color: 'red', label: t(status) || status };
  }
  return { color: 'gray', label: t(status) || status };
}

export function DashboardStats() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isRtl = i18n.language === 'ar';
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<PerformancePeriod>('week');

  useEffect(() => {
    api.getDashboardStats().then(setData).catch((error) => {
      console.error('Error fetching dashboard data:', error);
    });
  }, []);

  const stats = data || {
    pilgrims: { total: 0, male: 0, female: 0 },
    bookings: { total: 0, draft: 0, confirmed: 0, paid: 0, cancelled: 0 },
    financial: {
      totalAgreed: 0,
      totalPaid: 0,
      totalRemaining: 0,
      paymentPercentage: 0,
      totalExpenses: 0,
      totalBedsCost: 0,
      totalFlightsCost: 0,
      totalCosts: 0,
      netPosition: 0,
      inventoryProfit: 0,
      unpaidCount: 0,
    },
    recentBookings: [],
    accommodations: [],
    flightsCount: 0,
    hotelsCount: 0,
    clientsCount: 0,
    weeklyBookings: [],
    monthlyBookings: [],
    yearlyBookings: [],
    monthlyRevenue: [],
    destinations: [],
    upcomingSeasons: [],
    trends: { bookings: null, revenue: null, clients: null },
    performance: {
      week: { total: 0, growth: 0 },
      month: { total: 0, growth: 0 },
      year: { total: 0, growth: 0 },
    },
    seasonRevenue: { total: 0, growth: 0 },
    inventory: { hotel: { totalBeds: 0, soldBeds: 0, availableBeds: 0 }, flight: { totalSeats: 0, soldSeats: 0, availableSeats: 0 } },
    isFiltered: false,
  };

  const weekdayLabels = isRtl
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weekData = useMemo(() => (
    (stats.weeklyBookings || []).map((d) => ({
      ...d,
      label: weekdayLabels[d.weekday] || d.date.slice(8),
    }))
  ), [stats.weeklyBookings, weekdayLabels]);

  const monthData = useMemo(() => (
    (stats.monthlyRevenue || []).map((m) => {
      const [y, mo] = m.month.split('-');
      const date = new Date(Number(y), Number(mo) - 1, 1);
      const label = date.toLocaleDateString(isRtl ? 'ar' : 'fr', { month: 'short' });
      return { ...m, label };
    })
  ), [stats.monthlyRevenue, isRtl]);

  const destTotal = (stats.destinations || []).reduce((s, d) => s + d.value, 0);
  const destData = (stats.destinations || []).map((d) => ({
    ...d,
    name: d.name === 'other' ? (t('other_destinations') || 'أخرى') : destinationLabel(d.name, i18n.language),
  }));

  const performanceChart = useMemo(() => {
    if (period === 'month') {
      return (stats.monthlyBookings || []).map((d) => ({
        ...d,
        label: String(Number(d.date.slice(8))),
      }));
    }
    if (period === 'year') {
      return (stats.yearlyBookings || []).map((m) => {
        const [y, mo] = m.month.split('-');
        const date = new Date(Number(y), Number(mo) - 1, 1);
        return {
          ...m,
          label: date.toLocaleDateString(isRtl ? 'ar' : 'fr', { month: 'short' }),
        };
      });
    }
    return weekData;
  }, [period, stats.monthlyBookings, stats.yearlyBookings, weekData, isRtl]);

  const performanceMeta = period === 'month'
    ? stats.performance?.month
    : period === 'year'
      ? stats.performance?.year
      : stats.performance?.week;
  const performanceTotal = performanceMeta?.total ?? performanceChart.reduce((s, d) => s + (d.count || 0), 0);
  const performanceGrowth = performanceMeta?.growth ?? 0;
  const performanceTotalLabel = period === 'month'
    ? (t('bookings_this_month') || 'حجز هذا الشهر')
    : period === 'year'
      ? (t('bookings_this_year') || 'حجز هذه السنة')
      : (t('bookings_this_week') || 'حجز هذا الأسبوع');

  const seasonPct = stats.bookings.total > 0
    ? Math.round(((stats.bookings.confirmed + stats.bookings.paid) / stats.bookings.total) * 100)
    : stats.financial.paymentPercentage || 0;

  const sales = stats.financial.totalAgreed;
  const collected = stats.financial.totalPaid;
  const outstanding = stats.financial.totalRemaining;
  const collectionRate = stats.financial.paymentPercentage || 0;
  const netPosition = stats.financial.netPosition ?? (collected - (stats.financial.totalCosts || 0));
  const unpaidCount = stats.financial.unpaidCount || 0;
  const inventoryProfit = stats.financial.inventoryProfit || 0;

  const outstandingTone: KpiTone = outstanding <= 0
    ? 'success'
    : collectionRate < 70
      ? 'danger'
      : 'warning';
  const netTone: KpiTone = netPosition >= 0 ? 'success' : 'danger';
  const collectedTone: KpiTone = sales > 0 && collectionRate < 70 ? 'warning' : 'default';

  const outstandingHint = outstanding <= 0
    ? (t('kpi_unpaid_bookings_zero') || 'لا توجد أرصدة مفتوحة')
    : (t('kpi_unpaid_bookings', { count: unpaidCount }) || `${unpaidCount} حجوزات بأرصدة مفتوحة`);
  const netHint = netPosition >= 0
    ? (t('kpi_net_positive') || 'المحصل أعلى من التكاليف')
    : (t('kpi_net_negative') || 'التكاليف أعلى من المحصّل');

  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <Stack gap="lg">
      <Grid gutter="md">
        {/* ROW 1 */}
        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Stack gap="md" h="100%" justify="space-between">
            <Box
              style={{
                backgroundColor: '#F8F9FA',
                borderRadius: 24,
                overflow: 'hidden',
                position: 'relative',
                minHeight: 160,
                padding: '32px 40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isRtl ? 'flex-end' : 'flex-start',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              {/* Background Image Layer */}
              <Box
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: '65%',
                  backgroundImage: `url(${welcomeBg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'bottom right',
                  backgroundRepeat: 'no-repeat',
                  zIndex: 0,
                }}
              />
              {/* Gradient Overlay */}
              <Box
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, #F8F9FA 40%, rgba(248,249,250,0.9) 55%, rgba(248,249,250,0) 100%)',
                  zIndex: 1,
                }}
              />
              {/* Decorative circles */}
              <Box
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-10%',
                  width: '40%',
                  height: '200%',
                  background: 'radial-gradient(circle, rgba(12,119,116,0.04) 0%, rgba(248,249,250,0) 70%)',
                  zIndex: 1,
                }}
              />

              <Box style={{ position: 'relative', zIndex: 2, maxWidth: 640, textAlign: isRtl ? 'right' : 'left' }}>
                <Title order={2} fw={800} c={brand.navy} style={{ fontSize: 32, letterSpacing: '-0.5px' }}>
                  {t('dashboard_welcome') || 'مرحباً بك'}
                </Title>
                <Text size="md" fw={600} c={brand.teal} mt={4}>
                  في لوحة تحكم وكالة الحج والعمرة
                </Text>
                <Text size="sm" c={brand.muted} mt={8} style={{ opacity: 0.8 }}>
                  {t('dashboard_welcome_sub') || 'تابع الحجوزات والعمليات في الوقت الفعلي'}
                </Text>
              </Box>
            </Box>

            {stats.isFiltered && (
              <Alert icon={<Info size={16} />} color="teal" variant="light">
                {role === 'agent'
                  ? (t('agent_dashboard_info') || 'أنت ترى بيانات الحجوزات التي أنشأتها فقط.')
                  : (t('manager_dashboard_info') || 'أنت ترى بيانات الحجوزات من فرعك فقط.')}
              </Alert>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <KpiCard
                title={t('kpi_sales') || t('total_sales') || 'المبيعات'}
                value={`${compactNumber(sales)} MAD`}
                icon={<CreditCard size={22} />}
                trend={stats.trends?.revenue}
                to="/reports?tab=financial"
              />
              <KpiCard
                title={t('kpi_collected') || t('payments_received') || 'المحصّل'}
                value={`${compactNumber(collected)} MAD`}
                icon={<Wallet size={22} />}
                hint={`${collectionRate}% ${t('kpi_of_sales') || 'من المبيعات'}`}
                progress={collectionRate}
                tone={collectedTone}
                to="/reports?tab=financial"
              />
              <KpiCard
                title={t('kpi_outstanding') || t('total_pending') || 'المتبقي للتحصيل'}
                value={`${compactNumber(outstanding)} MAD`}
                icon={<AlertCircle size={22} />}
                hint={outstandingHint}
                progress={sales > 0 ? Math.round((outstanding / sales) * 100) : 0}
                tone={outstandingTone}
                to="/bookings"
              />
              <KpiCard
                title={t('kpi_net_position') || t('net_balance') || 'صافي الوضع'}
                value={`${compactNumber(netPosition)} MAD`}
                icon={<Scale size={22} />}
                hint={`${netHint} · ${t('inventory_profit') || 'ربح المخزون'} ${compactNumber(inventoryProfit)} MAD`}
                tone={netTone}
                to="/reports?tab=financial-status"
              />
            </SimpleGrid>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Paper p="lg" radius={20} style={{ ...cardStyle, height: '100%' }}>
            <Text fw={700} size="lg" c={brand.tealDeep} mb="md">
              {t('current_season') || 'موسم الحج الحالي'}
            </Text>
            <Box style={{ display: 'flex', justifyContent: 'center', position: 'relative' }} mb="md">
              <style>{`
                .gradient-ring .mantine-RingProgress-curve {
                  filter: drop-shadow(0px 6px 8px rgba(7, 29, 53, 0.25));
                }
              `}</style>
              <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                  <linearGradient id="season-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0C7774" />
                    <stop offset="100%" stopColor="#071D35" />
                  </linearGradient>
                </defs>
              </svg>
              <RingProgress
                className="gradient-ring"
                size={160}
                thickness={16}
                roundCaps
                rootColor="#F3F4F6"
                sections={[{ value: seasonPct, color: 'url(#season-gradient)' }]}
                label={
                  <Box ta="center">
                    <Text fz={32} fw={800} c={brand.navy} style={{ letterSpacing: '-0.5px' }}>{seasonPct}%</Text>
                    <Text fz={12} c={brand.muted}>مكتمل</Text>
                  </Box>
                }
              />
            </Box>
            <Stack gap={8}>
              <Group justify="space-between">
                <Text size="sm" c={brand.muted}>{t('bookings') || 'الحجوزات الكلية'}</Text>
                <Text size="sm" fw={700}>{stats.bookings.total.toLocaleString('en')}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c={brand.muted}>{t('confirmed') || 'الحجوزات المؤكدة'}</Text>
                <Text size="sm" fw={700}>{(stats.bookings.confirmed + stats.bookings.paid).toLocaleString('en')}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c={brand.muted}>{t('clients') || 'العملاء الحاليين'}</Text>
                <Text size="sm" fw={700}>{(stats.clientsCount || stats.pilgrims.total).toLocaleString('en')}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c={brand.muted}>{t('target_cities') || 'المدن المستهدفة'}</Text>
                <Text size="sm" fw={700}>{destData.length || 0}</Text>
              </Group>
            </Stack>
            <Box mt="md" pt="sm" style={{ borderTop: `1px solid ${brand.border}` }}>
              <Text size="xs" c={brand.muted} ta="center">
                متبقي {stats.bookings.total - (stats.bookings.confirmed + stats.bookings.paid)} حجز للاكتمال
              </Text>
            </Box>
          </Paper>
        </Grid.Col>

        {/* ROW 2 */}
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Paper p="lg" radius={20} style={{ ...cardStyle, height: '100%' }}>
            <Group justify="space-between" mb="md">
              <Text fw={700} size="lg" c={brand.tealDeep}>
                {t('booking_performance') || 'أداء الحجوزات'}
              </Text>
              <Group gap="xs">
                {([
                  { id: 'week' as const, label: t('weekly') || 'أسبوعي' },
                  { id: 'month' as const, label: t('monthly') || 'شهري' },
                  { id: 'year' as const, label: t('yearly') || 'سنوي' },
                ]).map((tab) => (
                  <Badge
                    key={tab.id}
                    variant={period === tab.id ? 'light' : 'subtle'}
                    color={period === tab.id ? 'teal' : 'gray'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setPeriod(tab.id)}
                  >
                    {tab.label}
                  </Badge>
                ))}
              </Group>
            </Group>
            
            <Box style={{ position: 'relative' }}>
              <Box h={220}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceChart} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bookingsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={brand.teal} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={brand.teal} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: brand.muted, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      interval={period === 'month' ? 4 : 0}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: brand.ivory,
                        border: `1px solid ${brand.border}`,
                        borderRadius: 12,
                        color: brand.navy,
                      }}
                      formatter={(value) => [`${value} ${t('bookings') || 'حجوزات'}`, '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={brand.teal}
                      strokeWidth={3}
                      fill="url(#bookingsFill)"
                      dot={period === 'month' ? false : { r: 5, fill: brand.ivory, stroke: brand.teal, strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: brand.teal }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
              
              <Box style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '25%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 30%, #fff 100%)' }}>
                <Text size="lg" fw={700} c={performanceGrowth >= 0 ? brand.teal : brand.danger}>
                  {performanceGrowth > 0 ? '+' : ''}{performanceGrowth}%
                </Text>
                <Text size="xs" c={brand.muted} mb="sm">{t('booking_growth') || 'نمو الحجوزات'}</Text>
                
                <Text size="xl" fw={800} c={brand.navy}>{performanceTotal.toLocaleString('en')}</Text>
                <Text size="xs" c={brand.muted} mb="sm">{performanceTotalLabel}</Text>
              </Box>
            </Box>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Paper p="lg" radius={20} style={{ ...cardStyle, height: '100%' }}>
            <Text fw={700} size="md" c={brand.tealDeep} mb="md" ta="center">
              {t('popular_destinations') || 'الوجهات الأكثر طلباً'}
            </Text>
            {destTotal > 0 ? (
              <Stack align="center" gap="md">
                <Box h={140} w={140} style={{ position: 'relative', flexShrink: 0 }}>
                  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                    <defs>
                      <linearGradient id="pie-grad-0" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0C7774" />
                        <stop offset="100%" stopColor="#071D35" />
                      </linearGradient>
                      <linearGradient id="pie-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#E5C46A" />
                        <stop offset="100%" stopColor="#C99A3D" />
                      </linearGradient>
                      <linearGradient id="pie-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#063F46" />
                        <stop offset="100%" stopColor="#0C7774" />
                      </linearGradient>
                      <linearGradient id="pie-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F8F0DC" />
                        <stop offset="100%" stopColor="#E5C46A" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={destData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={4} stroke="none">
                        {destData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text fw={700} size="sm" c={brand.navy}>{Math.round((destData[0]?.value / destTotal) * 100) || 0}%</Text>
                  </Box>
                </Box>
                <Stack gap={8} w="100%">
                  {destData.slice(0, 3).map((d, i) => (
                    <Group key={d.name} justify="space-between" wrap="nowrap">
                      <Group gap={8} wrap="nowrap">
                        <Box w={8} h={8} style={{ borderRadius: 99, background: PIE_LEGEND_COLORS[i % PIE_LEGEND_COLORS.length], flexShrink: 0 }} />
                        <Text size="xs" fw={500} c={brand.navy} truncate>{d.name}</Text>
                      </Group>
                      <Text size="xs" fw={700}>{Math.round((d.value / destTotal) * 100)}%</Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="md">{t('no_data')}</Text>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Paper p="lg" radius={20} style={{ ...cardStyle, height: '100%' }}>
            <Text fw={700} size="md" c={brand.tealDeep} mb="md">
              {t('upcoming_trips') || 'الرحلات القادمة'}
            </Text>
            <Stack gap="sm">
              {(stats.upcomingSeasons || []).slice(0, 3).map((season) => (
                <UnstyledButton
                  key={season.id}
                  onClick={() => navigate('/seasons')}
                  style={{ display: 'block', padding: '8px', borderRadius: 12, border: `1px solid ${brand.border}` }}
                >
                  <Group wrap="nowrap" gap="sm">
                    <Box
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        backgroundImage: `url(${season.type === 'hajj' ? kaabaDay : haramEvening})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        flexShrink: 0,
                      }}
                    />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={700} c={brand.navy} truncate>{season.name}</Text>
                      <Text size="xs" c={brand.muted} mt={2}>
                        {formatLocalDate(season.start_date)}{season.end_date ? ` — ${formatLocalDate(season.end_date)}` : ''}
                      </Text>
                    </Box>
                    <Chevron size={14} color={brand.teal} />
                  </Group>
                </UnstyledButton>
              ))}
              {(stats.upcomingSeasons || []).length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="md">{t('no_data')}</Text>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        {/* ROW 3 */}
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Paper p="lg" radius={20} style={{ ...cardStyle, height: '100%' }}>
            <Group justify="space-between" mb="md">
              <Text fw={700} size="lg" c={brand.tealDeep}>
                {t('latest_bookings') || 'آخر الحجوزات'}
              </Text>
              <Text size="sm" c={brand.teal} fw={600} style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
                عرض الكل
              </Text>
            </Group>
            
            <Box style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${brand.border}` }}>
                    <th style={{ textAlign: isRtl ? 'right' : 'left', padding: '12px 8px', color: brand.muted, fontSize: 12, fontWeight: 500 }}>العميل</th>
                    <th style={{ textAlign: isRtl ? 'right' : 'left', padding: '12px 8px', color: brand.muted, fontSize: 12, fontWeight: 500 }}>الرحلة</th>
                    <th style={{ textAlign: isRtl ? 'right' : 'left', padding: '12px 8px', color: brand.muted, fontSize: 12, fontWeight: 500 }}>التاريخ</th>
                    <th style={{ textAlign: isRtl ? 'right' : 'left', padding: '12px 8px', color: brand.muted, fontSize: 12, fontWeight: 500 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentBookings.slice(0, 4).map((booking, idx) => {
                    const badge = statusBadge(booking.status, t);
                    return (
                      <tr key={booking.id} style={{ borderBottom: idx < 3 ? `1px solid ${brand.border}` : 'none' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <Text size="sm" fw={600} c={brand.navy}>{booking.client_name}</Text>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Text size="sm" c={brand.navy}>{booking.season_name || booking.booking_number}</Text>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Text size="sm" c={brand.navy}>{formatLocalDate(booking.created_at)}</Text>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Badge variant="light" color={badge.color} radius="sm" size="sm">{badge.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {stats.recentBookings.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <Text size="sm" c="dimmed" ta="center" py="xl">{t('no_data') || 'لا توجد حجوزات'}</Text>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Box>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Paper p="lg" radius={20} style={{ ...cardStyle, height: '100%' }}>
            <Group justify="space-between" mb="xs">
              <Text fw={700} size="md" c={brand.tealDeep}>
                {t('season_revenue') || 'إيرادات الموسم'}
              </Text>
              <Text size="xs" fw={700} c={(stats.seasonRevenue?.growth || 0) >= 0 ? brand.teal : brand.danger}>
                {(stats.seasonRevenue?.growth || 0) > 0 ? '+' : ''}{stats.seasonRevenue?.growth || 0}%
              </Text>
            </Group>
            <Text size="lg" fw={800} c={brand.navy} mb="md">
              {compactNumber(stats.seasonRevenue?.total ?? stats.financial.totalAgreed)} MAD
            </Text>
            <Box h={140}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthData}>
                  <XAxis dataKey="label" tick={{ fill: brand.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: brand.ivory, border: `1px solid ${brand.border}`, borderRadius: 12 }}
                    formatter={(value) => [`${Number(value).toLocaleString('en')} MAD`, '']}
                    cursor={{ fill: 'rgba(12,119,116,0.05)' }}
                  />
                  <Bar dataKey="amount" fill={brand.teal} radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Stack gap="md" style={{ height: '100%' }}>
            <Paper p="lg" radius={20} style={cardStyle}>
              <Text fw={700} size="md" c={brand.tealDeep} mb="md">
                {t('quick_tasks') || 'مهام سريعة'}
              </Text>
              <SimpleGrid cols={2} spacing="sm">
                {[
                  { label: t('new_booking') || 'حجز جديد', icon: Plus, to: '/bookings/new' },
                  { label: t('add_client') || 'إضافة عميل', icon: UserPlus, to: '/clients' },
                  { label: t('client_support') || 'دعم العملاء', icon: MessageSquare, to: '/messages' },
                  { label: t('bookings_report') || 'تقرير الحجوزات', icon: FileText, to: '/reports' },
                ].map((action) => (
                  <UnstyledButton
                    key={action.to}
                    onClick={() => navigate(action.to)}
                    style={{
                      background: brand.tealSoft,
                      borderRadius: 12,
                      padding: '12px 8px',
                      textAlign: 'center',
                    }}
                  >
                    <ThemeIcon size={32} radius="md" variant="light" color="teal" mx="auto" mb={4}>
                      <action.icon size={16} />
                    </ThemeIcon>
                    <Text size="xs" fw={600} c={brand.navy}>{action.label}</Text>
                  </UnstyledButton>
                ))}
              </SimpleGrid>
            </Paper>

            <Paper
              p="lg"
              radius={20}
              style={{
                ...cardStyle,
                border: 'none',
                position: 'relative',
                overflow: 'hidden',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Box
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${quoteBg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transform: 'scale(1.3)',
                  zIndex: 0,
                }}
              />
              <Box
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 20,
                  fontFamily: 'serif',
                  fontSize: 54,
                  lineHeight: 0.8,
                  color: brand.tealDeep,
                  opacity: 0.6,
                  zIndex: 1,
                }}
              >
                “
              </Box>
              <Stack gap={8} align="center" style={{ position: 'relative', zIndex: 1, marginTop: 10 }}>
                <Text c={brand.navy} fw={800} style={{ fontSize: 18, textAlign: 'center', letterSpacing: '-0.5px' }}>
                  رحلة إيمانية آمنة وميسرة
                </Text>
                <Text c={brand.tealDeep} fw={600} style={{ fontSize: 13, textAlign: 'center', opacity: 0.9 }}>
                  هدفنا رضا ضيوف الرحمن
                </Text>
                <Box style={{ width: 40, height: 3, backgroundColor: brand.gold, borderRadius: 4, marginTop: 4 }} />
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

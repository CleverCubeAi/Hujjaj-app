import { useEffect, useMemo, useState } from 'react';
import {
  SimpleGrid, Paper, Text, Group, RingProgress, Title, Stack, Box, ThemeIcon, Badge, Alert, UnstyledButton, Grid,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Users, CreditCard, TrendingUp, TrendingDown, Info, Plane, Hotel, Plus, UserPlus, MessageSquare, FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { api } from '../../lib/api';
import { useAuth } from '../../providers/AuthProvider';
import { brand, cardStyle } from '../../theme/brand';
import { formatLocalDate } from '../../lib/dates';
import kaabaDay from '../../assets/img/kaaba-day.png';
import haramEvening from '../../assets/img/haram-evening.png';

interface DashboardData {
  pilgrims: { total: number; male: number; female: number };
  bookings: { total: number; draft: number; confirmed: number; paid: number; cancelled: number };
  financial: { totalAgreed: number; totalPaid: number; totalRemaining: number; paymentPercentage: number };
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
  monthlyRevenue?: Array<{ month: string; amount: number }>;
  destinations?: Array<{ name: string; value: number }>;
  upcomingSeasons?: Array<{ id: string; name: string; type: string; start_date?: string; end_date?: string; status?: string }>;
  trends?: { bookings: number; revenue: number; clients: number };
  inventory: {
    hotel: { totalBeds: number; soldBeds: number; availableBeds: number };
    flight: { totalSeats: number; soldSeats: number; availableSeats: number };
  };
  isFiltered: boolean;
}

const PIE_COLORS = [brand.teal, brand.gold, brand.tealDeep, brand.goldLight, brand.navy];

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return value.toLocaleString('en');
}

function KpiCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
}) {
  const { t } = useTranslation();
  const up = (trend || 0) >= 0;
  return (
    <Paper p="lg" radius={20} style={cardStyle}>
      <ThemeIcon size={44} radius="xl" variant="light" color="teal" mb="md">
        {icon}
      </ThemeIcon>
      <Text size="sm" c={brand.muted} fw={500}>{title}</Text>
      <Text fz={28} fw={700} c={brand.navy} mt={4} lh={1.1}>{value}</Text>
      {trend !== undefined && (
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

  useEffect(() => {
    api.getDashboardStats().then(setData).catch((error) => {
      console.error('Error fetching dashboard data:', error);
    });
  }, []);

  const stats = data || {
    pilgrims: { total: 0, male: 0, female: 0 },
    bookings: { total: 0, draft: 0, confirmed: 0, paid: 0, cancelled: 0 },
    financial: { totalAgreed: 0, totalPaid: 0, totalRemaining: 0, paymentPercentage: 0 },
    recentBookings: [],
    accommodations: [],
    flightsCount: 0,
    hotelsCount: 0,
    clientsCount: 0,
    weeklyBookings: [],
    monthlyRevenue: [],
    destinations: [],
    upcomingSeasons: [],
    trends: { bookings: 0, revenue: 0, clients: 0 },
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
  ), [stats.weeklyBookings, i18n.language]);

  const monthData = useMemo(() => (
    (stats.monthlyRevenue || []).map((m) => {
      const [y, mo] = m.month.split('-');
      const date = new Date(Number(y), Number(mo) - 1, 1);
      const label = date.toLocaleDateString(isRtl ? 'ar' : 'fr', { month: 'short' });
      return { ...m, label };
    })
  ), [stats.monthlyRevenue, i18n.language]);

  const destTotal = (stats.destinations || []).reduce((s, d) => s + d.value, 0);
  const destData = (stats.destinations || []).map((d) => ({
    ...d,
    name: d.name === 'other' ? (t('other_destinations') || 'أخرى') : d.name,
  }));

  const seasonPct = stats.bookings.total > 0
    ? Math.round(((stats.bookings.confirmed + stats.bookings.paid) / stats.bookings.total) * 100)
    : stats.financial.paymentPercentage || 0;

  const peak = weekData.reduce((m, d) => (d.count > m ? d.count : m), 0);

  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <Stack gap="lg">
      <Box
        style={{
          ...cardStyle,
          borderRadius: 24,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 132,
          padding: '28px 32px',
        }}
      >
        <Box
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${kaabaDay})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        <Box
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: isRtl
              ? 'linear-gradient(250deg, rgba(248,246,240,0.96) 12%, rgba(248,246,240,0.55) 55%, rgba(7,29,53,0.15) 100%)'
              : 'linear-gradient(100deg, rgba(248,246,240,0.96) 12%, rgba(248,246,240,0.55) 55%, rgba(7,29,53,0.15) 100%)',
          }}
        />
        <Box style={{ position: 'relative', zIndex: 1, maxWidth: 640 }}>
          <Title order={2} fw={700} c={brand.navy} style={{ fontSize: 26 }}>
            {t('dashboard_welcome') || 'مرحباً بك في لوحة تحكم وكالة الحج والعمرة'}
          </Title>
          <Text size="sm" c={brand.muted} mt={6}>
            {t('dashboard_welcome_sub') || 'نظرة عامة على الحجوزات والمواسم والإيرادات'}
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
          title={t('air_travels') || t('flights') || 'الرحلات الجوية'}
          value={stats.flightsCount}
          icon={<Plane size={22} />}
          trend={stats.trends?.bookings}
        />
        <KpiCard
          title={t('hotels') || 'الفنادق'}
          value={stats.hotelsCount || stats.accommodations.length}
          icon={<Hotel size={22} />}
        />
        <KpiCard
          title={t('clients') || 'العملاء'}
          value={(stats.clientsCount || stats.pilgrims.total).toLocaleString('en')}
          icon={<Users size={22} />}
          trend={stats.trends?.clients}
        />
        <KpiCard
          title={t('total_revenue') || 'الإيرادات'}
          value={`${compactNumber(stats.financial.totalAgreed)} MAD`}
          icon={<CreditCard size={22} />}
          trend={stats.trends?.revenue}
        />
      </SimpleGrid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
        <Paper p="lg" radius={20} style={cardStyle}>
          <Text fw={700} size="lg" c={brand.tealDeep} mb="md">
            {t('booking_performance') || 'أداء الحجوزات'}
          </Text>
          <Box h={260}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bookingsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={brand.teal} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={brand.teal} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: brand.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
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
                  dot={{ r: 5, fill: brand.ivory, stroke: brand.teal, strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: brand.teal }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
          {peak > 0 && (
            <Text size="xs" c={brand.teal} fw={600} ta="center">
              {peak} {t('bookings') || 'حجوزات'}
            </Text>
          )}
        </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
        <Paper p="lg" radius={20} style={cardStyle}>
          <Text fw={700} size="lg" c={brand.tealDeep} mb="md">
            {t('current_season') || 'الموسم الحالي'}
          </Text>
          <Box style={{ display: 'flex', justifyContent: 'center' }} mb="md">
            <RingProgress
              size={168}
              thickness={14}
              roundCaps
              sections={[{ value: seasonPct, color: brand.teal }]}
              label={
                <Box ta="center">
                  <Text fz={28} fw={700} c={brand.navy}>{seasonPct}%</Text>
                </Box>
              }
            />
          </Box>
          <Stack gap={10}>
            <Group justify="space-between">
              <Text size="sm" c={brand.muted}>{t('bookings') || 'الحجوزات'}</Text>
              <Text size="sm" fw={700}>{stats.bookings.total.toLocaleString('en')}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c={brand.muted}>{t('confirmed') || 'مؤكد'}</Text>
              <Text size="sm" fw={700}>{(stats.bookings.confirmed + stats.bookings.paid).toLocaleString('en')}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c={brand.muted}>{t('clients') || 'العملاء'}</Text>
              <Text size="sm" fw={700}>{(stats.clientsCount || stats.pilgrims.total).toLocaleString('en')}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c={brand.muted}>{t('target_cities') || 'المدن المستهدفة'}</Text>
              <Text size="sm" fw={700}>{destData.length || 0}</Text>
            </Group>
          </Stack>
        </Paper>
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
        <Paper p="lg" radius={20} style={cardStyle}>
          <Text fw={700} size="lg" c={brand.tealDeep} mb="md">
            {t('latest_bookings') || t('recent_bookings') || 'أحدث الحجوزات'}
          </Text>
          <Stack gap={0}>
            {stats.recentBookings.map((booking, idx) => {
              const badge = statusBadge(booking.status, t);
              return (
                <UnstyledButton
                  key={booking.id}
                  onClick={() => navigate(`/bookings/${booking.id}`)}
                  style={{
                    display: 'block',
                    padding: '12px 4px',
                    borderBottom: idx < stats.recentBookings.length - 1 ? `1px solid ${brand.border}` : 'none',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} c={brand.navy} truncate>{booking.client_name}</Text>
                      <Text size="xs" c={brand.muted} truncate>
                        {booking.season_name || booking.booking_number}
                      </Text>
                    </Box>
                    <Group gap="sm" wrap="nowrap">
                      <Text size="xs" c={brand.muted}>{formatLocalDate(booking.created_at)}</Text>
                      <Badge variant="light" color={badge.color} radius="sm">{badge.label}</Badge>
                    </Group>
                  </Group>
                </UnstyledButton>
              );
            })}
            {stats.recentBookings.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="xl">{t('no_data') || 'لا توجد حجوزات'}</Text>
            )}
          </Stack>
        </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
        <Stack gap="md">
          <Paper p="lg" radius={20} style={cardStyle}>
            <Text fw={700} size="md" c={brand.tealDeep} mb="sm">
              {t('popular_destinations') || 'الوجهات الأكثر طلباً'}
            </Text>
            {destTotal > 0 ? (
              <>
                <Box h={150}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={destData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3}>
                        {destData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                <Stack gap={4} mt="xs">
                  {destData.map((d, i) => (
                    <Group key={d.name} justify="space-between" gap={8}>
                      <Group gap={6}>
                        <Box w={8} h={8} style={{ borderRadius: 99, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <Text size="xs" c={brand.navy}>{d.name}</Text>
                      </Group>
                      <Text size="xs" fw={600}>{Math.round((d.value / destTotal) * 100)}%</Text>
                    </Group>
                  ))}
                </Stack>
              </>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="md">{t('no_data')}</Text>
            )}
          </Paper>

          <Paper p="lg" radius={20} style={cardStyle}>
            <Text fw={700} size="md" c={brand.tealDeep} mb="sm">
              {t('season_revenue') || 'إيرادات المواسم'}
            </Text>
            <Box h={140}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthData}>
                  <XAxis dataKey="label" tick={{ fill: brand.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: brand.ivory, border: `1px solid ${brand.border}`, borderRadius: 12 }}
                    formatter={(value) => [`${Number(value).toLocaleString('en')} MAD`, '']}
                  />
                  <Bar dataKey="amount" fill={brand.teal} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Stack>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
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
                  borderRadius: 16,
                  padding: 16,
                  textAlign: 'center',
                  border: `1px solid ${brand.border}`,
                }}
              >
                <ThemeIcon size={40} radius="md" variant="light" color="teal" mx="auto" mb={8}>
                  <action.icon size={18} />
                </ThemeIcon>
                <Text size="xs" fw={600} c={brand.navy}>{action.label}</Text>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </Paper>

        <Paper p="lg" radius={20} style={cardStyle}>
          <Text fw={700} size="md" c={brand.tealDeep} mb="md">
            {t('upcoming_trips') || 'الرحلات القادمة'}
          </Text>
          <Stack gap="sm">
            {(stats.upcomingSeasons || []).map((season) => (
              <UnstyledButton
                key={season.id}
                onClick={() => navigate('/seasons')}
                style={{ display: 'block' }}
              >
                <Group wrap="nowrap" gap="sm">
                  <Box
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      backgroundImage: `url(${season.type === 'hajj' ? kaabaDay : haramEvening})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      flexShrink: 0,
                    }}
                  />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} c={brand.navy} truncate>{season.name}</Text>
                    <Text size="xs" c={brand.muted}>
                      {formatLocalDate(season.start_date)}{season.end_date ? ` — ${formatLocalDate(season.end_date)}` : ''}
                    </Text>
                  </Box>
                  <Chevron size={16} color={brand.gold} />
                </Group>
              </UnstyledButton>
            ))}
            {(stats.upcomingSeasons || []).length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="md">{t('no_data')}</Text>
            )}
          </Stack>
        </Paper>

        <Paper
          p="lg"
          radius={20}
          style={{
            ...cardStyle,
            background: `linear-gradient(160deg, ${brand.tealDeep} 0%, ${brand.navy} 100%)`,
            border: 'none',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 180,
          }}
        >
          <Box
            aria-hidden
            style={{
              position: 'absolute',
              insetInlineEnd: -20,
              bottom: -16,
              opacity: 0.18,
            }}
          >
            <svg width="160" height="140" viewBox="0 0 160 140" fill="none">
              <path d="M80 130 V40" stroke={brand.gold} strokeWidth="3" />
              <path d="M55 70 Q80 20 105 70 Z" fill={brand.gold} />
              <path d="M30 130 V62" stroke={brand.goldLight} strokeWidth="2" />
              <circle cx="30" cy="56" r="5" fill={brand.goldLight} />
              <path d="M130 130 V58" stroke={brand.goldLight} strokeWidth="2" />
              <circle cx="130" cy="52" r="5" fill={brand.goldLight} />
            </svg>
          </Box>
          <Text size="sm" c={brand.goldLight} fw={600} mb="sm">
            {t('dashboard_quote_label') || 'تذكير'}
          </Text>
          <Text c={brand.ivory} fw={700} style={{ fontSize: 18, lineHeight: 1.7, position: 'relative' }}>
            {t('dashboard_quote') || 'وَأَذِّن فِي النَّاسِ بِالْحَجِّ يَأْتُوكَ رِجَالًا'}
          </Text>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}

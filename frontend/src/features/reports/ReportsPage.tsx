import { useEffect, useState } from 'react';
import {
  Title, Stack, Paper, Card, Group, Text, Select,
  Button, Table, Badge, SimpleGrid, Tabs, LoadingOverlay,
  Divider, ThemeIcon, Accordion, Alert
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';
import { useAuth } from '../../providers/AuthProvider';
import {
  Download, TrendingUp, DollarSign, Users, Calendar,
  Hotel, Plane, CreditCard, BarChart3, Wallet, ArrowUpCircle,
  ArrowDownCircle, Receipt, BedDouble, PlaneTakeoff, AlertCircle,
  Send
} from 'lucide-react';
import { HandoverFormModal } from './HandoverFormModal';
import { HandoversList } from './HandoversList';
import { HandoverStatusModal } from './HandoverStatusModal';

interface ReportData {
  financial: {
    total_revenue: number;
    total_received: number;
    total_pending: number;
    bookings_count: number;
    average_booking_value: number;
  };
  bookings: {
    by_status: Array<{ status: string; count: number; total: number }>;
    by_season: Array<{ season_name: string; count: number; total: number }>;
    recent: Array<{
      id: string;
      booking_number: string;
      client_name: string;
      total_amount: number;
      paid_amount: number;
      status: string;
      created_at: string;
    }>;
  };
  pilgrims: {
    total: number;
    by_gender: { male: number; female: number };
    by_status: Array<{ status: string; count: number }>;
  };
  accommodations: {
    total_rooms: number;
    occupied_rooms: number;
    occupancy_rate: number;
    by_hotel: Array<{ name: string; occupied: number; total: number }>;
  };
  flights: {
    total: number;
    direct: number;
    indirect: number;
    by_season: Array<{ season_name: string; count: number }>;
  };
}

interface FinancialStatusData {
  summary: {
    total_sales: number;
    payments_received: number;
    pending_payments: number;
    total_purchases: number;
    total_expenses: number;
    total_beds_cost: number;
    total_flights_cost: number;
    balance_to_admin: number;
    inventory_profit: number;
  };
  sales: {
    total: number;
    received: number;
    pending: number;
    bookings_count: number;
    details: Array<{
      id: string;
      booking_number: string;
      client_name: string;
      total_amount: number;
      paid_amount: number;
      remaining: number;
      status: string;
      created_at: string;
    }>;
  };
  purchases: {
    expenses: {
      total: number;
      by_category: Array<{
        category: string;
        count: number;
        total: number;
        items: Array<{
          id: string;
          description: string;
          amount: number;
          paid_date: string;
          type: string;
        }>;
      }>;
      count: number;
    };
    beds: {
      total_cost: number;
      total_purchased: number;
      total_sold: number;
      revenue: number;
      profit: number;
      details: Array<{
        id: string;
        hotel_name: string;
        city: string;
        room_type: string;
        beds_purchased: number;
        purchase_price: number;
        total_cost: number;
        beds_sold: number;
        beds_available: number;
        sell_price: number;
        revenue: number;
        profit: number;
        check_in: string;
        check_out: string;
        supplier: string;
      }>;
    };
    flights: {
      total_cost: number;
      total_purchased: number;
      total_sold: number;
      revenue: number;
      profit: number;
      details: Array<{
        id: string;
        flight_code: string;
        route: string;
        carrier: string;
        departure_date: string;
        seats_purchased: number;
        purchase_price: number;
        total_cost: number;
        seats_sold: number;
        seats_available: number;
        sell_price: number;
        revenue: number;
        profit: number;
        supplier: string;
      }>;
    };
  };
  balance: {
    money_received: number;
    money_spent: number;
    net_balance: number;
    status: 'to_pay' | 'to_receive';
  };
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [financialStatus, setFinancialStatus] = useState<FinancialStatusData | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Array<{ id: string; name: string }>>([]);
  const [activeTab, setActiveTab] = useState<string | null>('financial');

  // Handover state
  const [handoverFormOpened, setHandoverFormOpened] = useState(false);
  const [handoverDetailsOpened, setHandoverDetailsOpened] = useState(false);
  const [selectedHandoverId, setSelectedHandoverId] = useState<string | null>(null);
  const [handoverRefreshTrigger, setHandoverRefreshTrigger] = useState(0);
  const [defaultHandoverType, setDefaultHandoverType] = useState<'sales_to_admin' | 'expense_reimbursement'>('sales_to_admin');

  const { role } = useAuth();
  const isAdmin = role === 'agency_admin' || role === 'super_admin';

  const fetchSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data || []);
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (selectedSeason) params.set('season_id', selectedSeason);
      if (dateFrom) {
        params.set('date_from', dateFrom);
      }
      if (dateTo) {
        params.set('date_to', dateTo);
      }

      const data = await api.getReports(params.toString());
      setReportData(data);
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || t('error_fetching_reports') || 'خطأ في جلب التقارير',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialStatus = async () => {
    setFinancialLoading(true);
    try {
      const params: any = {};
      if (selectedSeason) params.season_id = selectedSeason;
      if (dateFrom) {
        params.date_from = dateFrom;
      }
      if (dateTo) {
        params.date_to = dateTo;
      }

      const data = await api.getFinancialStatus(params);
      setFinancialStatus(data);
    } catch (error: any) {
      console.error('Error fetching financial status:', error);
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || t('error_fetching_financial_status') || 'خطأ في جلب الوضعية المالية',
        color: 'red'
      });
    } finally {
      setFinancialLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  useEffect(() => {
    fetchReports();
    fetchFinancialStatus();
  }, [selectedSeason, dateFrom, dateTo]);

  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedSeason) params.set('season_id', selectedSeason);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('format', format);
      params.set('tab', activeTab || 'financial');

      await api.exportReport(params.toString());
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('export_started') || 'جاري تحميل التقرير...',
        color: 'green'
      });
    } catch (error: any) {
      console.error('Error exporting report:', error);
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || t('export_error') || 'خطأ في تصدير التقرير',
        color: 'red'
      });
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    const n = Number(amount);
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0
    }).format(Number.isFinite(n) ? n : 0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-MA');
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('reports') || 'التقارير'}</Title>
        <Group>
          <Button
            leftSection={<Download size={16} />}
            variant="light"
            onClick={() => handleExport('pdf')}
            loading={exporting}
            disabled={exporting}
          >
            {t('export_pdf') || 'تصدير PDF'}
          </Button>
          <Button
            leftSection={<Download size={16} />}
            variant="light"
            onClick={() => handleExport('excel')}
            loading={exporting}
            disabled={exporting}
          >
            {t('export_excel') || 'تصدير Excel'}
          </Button>
        </Group>
      </Group>

      {/* Filters */}
      <Paper p="md" withBorder>
        <Group>
          <Select
            label={t('season') || 'الموسم'}
            placeholder={t('all_seasons') || 'جميع المواسم'}
            data={seasons.map(s => ({ value: s.id, label: s.name }))}
            value={selectedSeason}
            onChange={setSelectedSeason}
            clearable
            style={{ flex: 1 }}
          />
          <DateInput
            label={t('from_date') || 'من تاريخ'}
            placeholder={t('select_date') || 'اختر التاريخ'}
            value={dateFrom}
            onChange={setDateFrom}
            valueFormat="YYYY-MM-DD"
            clearable
            popoverProps={{ withinPortal: true }}
          />
          <DateInput
            label={t('to_date') || 'إلى تاريخ'}
            placeholder={t('select_date') || 'اختر التاريخ'}
            value={dateTo}
            onChange={setDateTo}
            valueFormat="YYYY-MM-DD"
            clearable
            popoverProps={{ withinPortal: true }}
          />
        </Group>
      </Paper>

      {loading ? (
        <LoadingOverlay visible />
      ) : reportData ? (
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="financial" leftSection={<DollarSign size={16} />}>
              {t('financial_reports') || 'التقارير المالية'}
            </Tabs.Tab>
            <Tabs.Tab value="financial-status" leftSection={<Wallet size={16} />}>
              {t('financial_status') || 'الوضعية المالية'}
            </Tabs.Tab>
            <Tabs.Tab value="bookings" leftSection={<Calendar size={16} />}>
              {t('booking_reports') || 'تقارير الحجوزات'}
            </Tabs.Tab>
            <Tabs.Tab value="pilgrims" leftSection={<Users size={16} />}>
              {t('pilgrim_reports') || 'تقارير المعتمرين'}
            </Tabs.Tab>
            <Tabs.Tab value="operations" leftSection={<BarChart3 size={16} />}>
              {t('operational_reports') || 'التقارير التشغيلية'}
            </Tabs.Tab>
          </Tabs.List>

          {/* Financial Reports */}
          <Tabs.Panel value="financial" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="lg">
              <Card withBorder p="md" radius="md">
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase">{t('total_agreed') || 'المتفق عليه'}</Text>
                    <Text fw={700} size="xl" c="green">
                      {formatCurrency(reportData.financial.total_revenue)}
                    </Text>
                  </div>
                  <TrendingUp size={32} color="#51cf66" />
                </Group>
              </Card>
              <Card withBorder p="md" radius="md">
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase">{t('total_received') || 'المستلم'}</Text>
                    <Text fw={700} size="xl" c="blue">
                      {formatCurrency(reportData.financial.total_received)}
                    </Text>
                  </div>
                  <CreditCard size={32} color="#228be6" />
                </Group>
              </Card>
              <Card withBorder p="md" radius="md">
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase">{t('total_pending') || 'المتبقي'}</Text>
                    <Text fw={700} size="xl" c="red">
                      {formatCurrency(reportData.financial.total_pending)}
                    </Text>
                  </div>
                  <DollarSign size={32} color="#fa5252" />
                </Group>
              </Card>
              <Card withBorder p="md" radius="md">
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase">{t('bookings_count') || 'عدد الحجوزات'}</Text>
                    <Text fw={700} size="xl">
                      {reportData.financial.bookings_count}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('avg_booking_value') || 'متوسط قيمة الحجز'}: {formatCurrency(reportData.financial.average_booking_value)}
                    </Text>
                  </div>
                  <Calendar size={32} color="#0C7774" />
                </Group>
              </Card>
            </SimpleGrid>
          </Tabs.Panel>

          {/* Financial Status - الوضعية المالية */}
          <Tabs.Panel value="financial-status" pt="md">
            {financialLoading ? (
              <LoadingOverlay visible />
            ) : financialStatus ? (
              <Stack gap="lg">
                {/* Balance Summary Card */}
                <Card withBorder p="lg" radius="md" bg={financialStatus.balance.net_balance >= 0 ? 'green.0' : 'red.0'}>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="sm" c="dimmed" fw={500}>
                        {t('balance_to_admin') || 'الرصيد المستحق للإدارة'}
                      </Text>
                      <Text fw={700} size="2rem" c={financialStatus.balance.net_balance >= 0 ? 'green.7' : 'red.7'}>
                        {formatCurrency(Math.abs(financialStatus.balance.net_balance))}
                      </Text>
                      <Text size="sm" c={financialStatus.balance.net_balance >= 0 ? 'green.6' : 'red.6'}>
                        {financialStatus.balance.net_balance >= 0 
                          ? (t('amount_to_hand_admin') || 'مبلغ يجب تسليمه للإدارة')
                          : (t('amount_to_receive_from_admin') || 'مبلغ يجب استلامه من الإدارة')}
                      </Text>
                    </div>
                    <Group>
                      <Button
                        leftSection={<Send size={16} />}
                        color={financialStatus.balance.net_balance >= 0 ? 'green' : 'orange'}
                        onClick={() => {
                          setDefaultHandoverType(financialStatus.balance.net_balance >= 0 ? 'sales_to_admin' : 'expense_reimbursement');
                          setHandoverFormOpened(true);
                        }}
                      >
                        {t('notify_handover') || 'إبلاغ بالتسليم'}
                      </Button>
                      <ThemeIcon 
                        size={64} 
                        radius="xl" 
                        color={financialStatus.balance.net_balance >= 0 ? 'green' : 'red'}
                        variant="light"
                      >
                        {financialStatus.balance.net_balance >= 0 
                          ? <ArrowUpCircle size={36} />
                          : <ArrowDownCircle size={36} />}
                      </ThemeIcon>
                    </Group>
                  </Group>
                </Card>

                {/* Summary Cards */}
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                  <Card withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase">{t('total_sales') || 'إجمالي المبيعات'}</Text>
                        <Text fw={700} size="xl" c="blue">
                          {formatCurrency(financialStatus.summary.total_sales)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {financialStatus.sales.bookings_count} {t('bookings') || 'حجوزات'}
                        </Text>
                      </div>
                      <ThemeIcon size={48} color="blue" variant="light" radius="md">
                        <TrendingUp size={24} />
                      </ThemeIcon>
                    </Group>
                  </Card>

                  <Card withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase">{t('payments_received') || 'المبالغ المستلمة'}</Text>
                        <Text fw={700} size="xl" c="green">
                          {formatCurrency(financialStatus.summary.payments_received)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t('pending') || 'متبقي'}: {formatCurrency(financialStatus.summary.pending_payments)}
                        </Text>
                      </div>
                      <ThemeIcon size={48} color="green" variant="light" radius="md">
                        <CreditCard size={24} />
                      </ThemeIcon>
                    </Group>
                  </Card>

                  <Card withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase">{t('total_purchases') || 'إجمالي المشتريات'}</Text>
                        <Text fw={700} size="xl" c="red">
                          {formatCurrency(financialStatus.summary.total_purchases)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t('expenses_beds_flights') || 'مصاريف + أسرة + رحلات'}
                        </Text>
                      </div>
                      <ThemeIcon size={48} color="red" variant="light" radius="md">
                        <Receipt size={24} />
                      </ThemeIcon>
                    </Group>
                  </Card>

                  <Card withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase">{t('inventory_profit') || 'ربح المخزون'}</Text>
                        <Text fw={700} size="xl" c={financialStatus.summary.inventory_profit >= 0 ? 'teal' : 'red'}>
                          {formatCurrency(financialStatus.summary.inventory_profit)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t('from_beds_and_flights') || 'من الأسرة والرحلات'}
                        </Text>
                      </div>
                      <ThemeIcon size={48} color="teal" variant="light" radius="md">
                        <BarChart3 size={24} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </SimpleGrid>

                {/* Details Accordion */}
                <Accordion variant="separated" radius="md">
                  {/* Sales Details */}
                  <Accordion.Item value="sales">
                    <Accordion.Control icon={<ArrowUpCircle size={20} color="#228be6" />}>
                      <Group justify="space-between" pr="md">
                        <Text fw={600}>{t('sales_details') || 'تفاصيل المبيعات'}</Text>
                        <Badge size="lg" color="blue" variant="light">
                          {formatCurrency(financialStatus.sales.total)}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <SimpleGrid cols={3}>
                          <Paper p="sm" bg="blue.0" radius="md">
                            <Text size="xs" c="dimmed">{t('total_sales') || 'إجمالي المبيعات'}</Text>
                            <Text fw={600}>{formatCurrency(financialStatus.sales.total)}</Text>
                          </Paper>
                          <Paper p="sm" bg="green.0" radius="md">
                            <Text size="xs" c="dimmed">{t('received') || 'مستلم'}</Text>
                            <Text fw={600} c="green">{formatCurrency(financialStatus.sales.received)}</Text>
                          </Paper>
                          <Paper p="sm" bg="orange.0" radius="md">
                            <Text size="xs" c="dimmed">{t('pending') || 'متبقي'}</Text>
                            <Text fw={600} c="orange">{formatCurrency(financialStatus.sales.pending)}</Text>
                          </Paper>
                        </SimpleGrid>

                        {financialStatus.sales.details.length > 0 && (
                          <Table striped highlightOnHover>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>{t('booking_number') || 'رقم الحجز'}</Table.Th>
                                <Table.Th>{t('client') || 'العميل'}</Table.Th>
                                <Table.Th>{t('total') || 'المجموع'}</Table.Th>
                                <Table.Th>{t('paid') || 'مدفوع'}</Table.Th>
                                <Table.Th>{t('remaining') || 'متبقي'}</Table.Th>
                                <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {financialStatus.sales.details.map((sale) => (
                                <Table.Tr key={sale.id}>
                                  <Table.Td>{sale.booking_number}</Table.Td>
                                  <Table.Td>{sale.client_name}</Table.Td>
                                  <Table.Td>{formatCurrency(sale.total_amount)}</Table.Td>
                                  <Table.Td c="green">{formatCurrency(sale.paid_amount)}</Table.Td>
                                  <Table.Td c="orange">{formatCurrency(sale.remaining)}</Table.Td>
                                  <Table.Td>
                                    <Badge size="sm" variant="light" color={
                                      sale.status === 'confirmed' ? 'green' :
                                      sale.status === 'paid' ? 'blue' :
                                      sale.status === 'cancelled' ? 'red' : 'gray'
                                    }>
                                      {t(sale.status) || sale.status}
                                    </Badge>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Expenses Details */}
                  <Accordion.Item value="expenses">
                    <Accordion.Control icon={<Receipt size={20} color="#fa5252" />}>
                      <Group justify="space-between" pr="md">
                        <Text fw={600}>{t('expenses') || 'المصاريف'}</Text>
                        <Badge size="lg" color="red" variant="light">
                          {formatCurrency(financialStatus.purchases.expenses.total)}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {financialStatus.purchases.expenses.by_category.length > 0 ? (
                        <Stack gap="md">
                          {financialStatus.purchases.expenses.by_category.map((cat) => (
                            <Paper key={cat.category} p="md" withBorder radius="md">
                              <Group justify="space-between" mb="sm">
                                <Text fw={600}>{cat.category}</Text>
                                <Badge color="red" variant="light">{formatCurrency(cat.total)}</Badge>
                              </Group>
                              <Text size="sm" c="dimmed">{cat.count} {t('items') || 'عناصر'}</Text>
                            </Paper>
                          ))}
                        </Stack>
                      ) : (
                        <Text c="dimmed" ta="center">{t('no_expenses') || 'لا توجد مصاريف'}</Text>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Hotel Beds Details */}
                  <Accordion.Item value="beds">
                    <Accordion.Control icon={<BedDouble size={20} color="#be4bdb" />}>
                      <Group justify="space-between" pr="md">
                        <Text fw={600}>{t('hotel_beds') || 'أسرة الفنادق'}</Text>
                        <Group gap="xs">
                          <Badge size="lg" color="red" variant="light">
                            {t('cost') || 'تكلفة'}: {formatCurrency(financialStatus.purchases.beds.total_cost)}
                          </Badge>
                          <Badge size="lg" color={financialStatus.purchases.beds.profit >= 0 ? 'green' : 'red'} variant="light">
                            {t('profit') || 'ربح'}: {formatCurrency(financialStatus.purchases.beds.profit)}
                          </Badge>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <SimpleGrid cols={4}>
                          <Paper p="sm" bg="violet.0" radius="md">
                            <Text size="xs" c="dimmed">{t('beds_purchased') || 'أسرة مشتراة'}</Text>
                            <Text fw={600}>{financialStatus.purchases.beds.total_purchased}</Text>
                          </Paper>
                          <Paper p="sm" bg="green.0" radius="md">
                            <Text size="xs" c="dimmed">{t('beds_sold') || 'أسرة مباعة'}</Text>
                            <Text fw={600}>{financialStatus.purchases.beds.total_sold}</Text>
                          </Paper>
                          <Paper p="sm" bg="blue.0" radius="md">
                            <Text size="xs" c="dimmed">{t('revenue') || 'الإيرادات'}</Text>
                            <Text fw={600}>{formatCurrency(financialStatus.purchases.beds.revenue)}</Text>
                          </Paper>
                          <Paper p="sm" bg={financialStatus.purchases.beds.profit >= 0 ? 'green.0' : 'red.0'} radius="md">
                            <Text size="xs" c="dimmed">{t('profit') || 'الربح'}</Text>
                            <Text fw={600} c={financialStatus.purchases.beds.profit >= 0 ? 'green' : 'red'}>
                              {formatCurrency(financialStatus.purchases.beds.profit)}
                            </Text>
                          </Paper>
                        </SimpleGrid>

                        {financialStatus.purchases.beds.details.length > 0 && (
                          <Table striped highlightOnHover>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>{t('hotel') || 'الفندق'}</Table.Th>
                                <Table.Th>{t('room_type') || 'نوع الغرفة'}</Table.Th>
                                <Table.Th>{t('purchased') || 'مشترى'}</Table.Th>
                                <Table.Th>{t('sold') || 'مباع'}</Table.Th>
                                <Table.Th>{t('available') || 'متاح'}</Table.Th>
                                <Table.Th>{t('cost') || 'التكلفة'}</Table.Th>
                                <Table.Th>{t('revenue') || 'الإيراد'}</Table.Th>
                                <Table.Th>{t('profit') || 'الربح'}</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {financialStatus.purchases.beds.details.map((bed) => (
                                <Table.Tr key={bed.id}>
                                  <Table.Td>{bed.hotel_name}</Table.Td>
                                  <Table.Td>{t(bed.room_type) || bed.room_type}</Table.Td>
                                  <Table.Td>{bed.beds_purchased}</Table.Td>
                                  <Table.Td c="green">{bed.beds_sold}</Table.Td>
                                  <Table.Td c="blue">{bed.beds_available}</Table.Td>
                                  <Table.Td c="red">{formatCurrency(bed.total_cost)}</Table.Td>
                                  <Table.Td>{formatCurrency(bed.revenue)}</Table.Td>
                                  <Table.Td c={bed.profit >= 0 ? 'green' : 'red'}>
                                    {formatCurrency(bed.profit)}
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Flight Seats Details */}
                  <Accordion.Item value="flights">
                    <Accordion.Control icon={<PlaneTakeoff size={20} color="#228be6" />}>
                      <Group justify="space-between" pr="md">
                        <Text fw={600}>{t('flight_seats') || 'مقاعد الطائرات'}</Text>
                        <Group gap="xs">
                          <Badge size="lg" color="red" variant="light">
                            {t('cost') || 'تكلفة'}: {formatCurrency(financialStatus.purchases.flights.total_cost)}
                          </Badge>
                          <Badge size="lg" color={financialStatus.purchases.flights.profit >= 0 ? 'green' : 'red'} variant="light">
                            {t('profit') || 'ربح'}: {formatCurrency(financialStatus.purchases.flights.profit)}
                          </Badge>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <SimpleGrid cols={4}>
                          <Paper p="sm" bg="cyan.0" radius="md">
                            <Text size="xs" c="dimmed">{t('seats_purchased') || 'مقاعد مشتراة'}</Text>
                            <Text fw={600}>{financialStatus.purchases.flights.total_purchased}</Text>
                          </Paper>
                          <Paper p="sm" bg="green.0" radius="md">
                            <Text size="xs" c="dimmed">{t('seats_sold') || 'مقاعد مباعة'}</Text>
                            <Text fw={600}>{financialStatus.purchases.flights.total_sold}</Text>
                          </Paper>
                          <Paper p="sm" bg="blue.0" radius="md">
                            <Text size="xs" c="dimmed">{t('revenue') || 'الإيرادات'}</Text>
                            <Text fw={600}>{formatCurrency(financialStatus.purchases.flights.revenue)}</Text>
                          </Paper>
                          <Paper p="sm" bg={financialStatus.purchases.flights.profit >= 0 ? 'green.0' : 'red.0'} radius="md">
                            <Text size="xs" c="dimmed">{t('profit') || 'الربح'}</Text>
                            <Text fw={600} c={financialStatus.purchases.flights.profit >= 0 ? 'green' : 'red'}>
                              {formatCurrency(financialStatus.purchases.flights.profit)}
                            </Text>
                          </Paper>
                        </SimpleGrid>

                        {financialStatus.purchases.flights.details.length > 0 ? (
                          <Table striped highlightOnHover>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>{t('flight_code') || 'رمز الرحلة'}</Table.Th>
                                <Table.Th>{t('route') || 'المسار'}</Table.Th>
                                <Table.Th>{t('purchased') || 'مشترى'}</Table.Th>
                                <Table.Th>{t('sold') || 'مباع'}</Table.Th>
                                <Table.Th>{t('available') || 'متاح'}</Table.Th>
                                <Table.Th>{t('cost') || 'التكلفة'}</Table.Th>
                                <Table.Th>{t('revenue') || 'الإيراد'}</Table.Th>
                                <Table.Th>{t('profit') || 'الربح'}</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {financialStatus.purchases.flights.details.map((flight) => (
                                <Table.Tr key={flight.id}>
                                  <Table.Td>{flight.flight_code}</Table.Td>
                                  <Table.Td>{flight.route}</Table.Td>
                                  <Table.Td>{flight.seats_purchased}</Table.Td>
                                  <Table.Td c="green">{flight.seats_sold}</Table.Td>
                                  <Table.Td c="blue">{flight.seats_available}</Table.Td>
                                  <Table.Td c="red">{formatCurrency(flight.total_cost)}</Table.Td>
                                  <Table.Td>{formatCurrency(flight.revenue)}</Table.Td>
                                  <Table.Td c={flight.profit >= 0 ? 'green' : 'red'}>
                                    {formatCurrency(flight.profit)}
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        ) : (
                          <Text c="dimmed" ta="center">{t('no_flight_inventory') || 'لا يوجد مخزون رحلات'}</Text>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>

                {/* Balance Breakdown */}
                <Paper p="lg" withBorder radius="md">
                  <Text fw={600} size="lg" mb="md">{t('balance_breakdown') || 'تفصيل الرصيد'}</Text>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text>{t('money_received_from_clients') || 'المبالغ المستلمة من العملاء'}</Text>
                      <Text fw={600} c="green">+ {formatCurrency(financialStatus.balance.money_received)}</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Text>{t('expenses_paid') || 'المصاريف المدفوعة'}</Text>
                      <Text fw={600} c="red">- {formatCurrency(financialStatus.purchases.expenses.total)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text>{t('hotel_beds_cost') || 'تكلفة أسرة الفنادق'}</Text>
                      <Text fw={600} c="red">- {formatCurrency(financialStatus.purchases.beds.total_cost)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text>{t('flight_seats_cost') || 'تكلفة مقاعد الطائرات'}</Text>
                      <Text fw={600} c="red">- {formatCurrency(financialStatus.purchases.flights.total_cost)}</Text>
                    </Group>
                    <Divider variant="dashed" />
                    <Group justify="space-between">
                      <Text fw={700}>{t('net_balance') || 'صافي الرصيد'}</Text>
                      <Text fw={700} size="lg" c={financialStatus.balance.net_balance >= 0 ? 'green' : 'red'}>
                        {financialStatus.balance.net_balance >= 0 ? '+' : ''} {formatCurrency(financialStatus.balance.net_balance)}
                      </Text>
                    </Group>
                  </Stack>

                  {/* Alert based on balance */}
                  <Alert
                    mt="lg"
                    variant="light"
                    color={financialStatus.balance.net_balance >= 0 ? 'green' : 'orange'}
                    icon={<AlertCircle size={20} />}
                    title={financialStatus.balance.net_balance >= 0 
                      ? (t('amount_due_to_admin') || 'مبلغ مستحق للإدارة')
                      : (t('amount_due_from_admin') || 'مبلغ مستحق من الإدارة')}
                  >
                    {financialStatus.balance.net_balance >= 0 
                      ? (t('hand_amount_to_admin_message') || `يجب تسليم مبلغ ${formatCurrency(financialStatus.balance.net_balance)} للإدارة`)
                      : (t('receive_amount_from_admin_message') || `يجب استلام مبلغ ${formatCurrency(Math.abs(financialStatus.balance.net_balance))} من الإدارة`)}
                  </Alert>
                </Paper>

                {/* Financial Handovers List */}
                <HandoversList
                  seasonId={selectedSeason}
                  refreshTrigger={handoverRefreshTrigger}
                  onViewDetails={(handover) => {
                    setSelectedHandoverId(handover.id);
                    setHandoverDetailsOpened(true);
                  }}
                />
              </Stack>
            ) : (
              <Paper p="xl" withBorder>
                <Text ta="center" c="dimmed">{t('no_data') || 'لا توجد بيانات'}</Text>
              </Paper>
            )}
          </Tabs.Panel>

          {/* Booking Reports */}
          <Tabs.Panel value="bookings" pt="md">
            <SimpleGrid cols={{ base: 1, md: 2 }} mb="lg">
              <Paper p="md" withBorder>
                <Text fw={600} mb="md">{t('bookings_by_status') || 'الحجوزات حسب الحالة'}</Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                      <Table.Th>{t('count') || 'العدد'}</Table.Th>
                      <Table.Th>{t('total') || 'المجموع'}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {reportData.bookings.by_status.map((item) => (
                      <Table.Tr key={item.status}>
                        <Table.Td>
                          <Badge variant="light">{t(item.status) || item.status}</Badge>
                        </Table.Td>
                        <Table.Td>{item.count}</Table.Td>
                        <Table.Td>{formatCurrency(item.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>

              <Paper p="md" withBorder>
                <Text fw={600} mb="md">{t('bookings_by_season') || 'الحجوزات حسب الموسم'}</Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('season') || 'الموسم'}</Table.Th>
                      <Table.Th>{t('count') || 'العدد'}</Table.Th>
                      <Table.Th>{t('total') || 'المجموع'}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {reportData.bookings.by_season.map((item) => (
                      <Table.Tr key={item.season_name}>
                        <Table.Td>{item.season_name}</Table.Td>
                        <Table.Td>{item.count}</Table.Td>
                        <Table.Td>{formatCurrency(item.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </SimpleGrid>

            <Paper p="md" withBorder>
              <Text fw={600} mb="md">{t('recent_bookings') || 'الحجوزات الأخيرة'}</Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('booking_number') || 'رقم الحجز'}</Table.Th>
                    <Table.Th>{t('client') || 'العميل'}</Table.Th>
                    <Table.Th>{t('total_amount') || 'المبلغ الإجمالي'}</Table.Th>
                    <Table.Th>{t('paid') || 'المدفوع'}</Table.Th>
                    <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                    <Table.Th>{t('date') || 'التاريخ'}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {reportData.bookings.recent.map((booking) => (
                    <Table.Tr key={booking.id}>
                      <Table.Td>{booking.booking_number}</Table.Td>
                      <Table.Td>{booking.client_name}</Table.Td>
                      <Table.Td>{formatCurrency(booking.total_amount)}</Table.Td>
                      <Table.Td>{formatCurrency(booking.paid_amount)}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={
                          booking.status === 'confirmed' ? 'green' :
                          booking.status === 'draft' ? 'gray' :
                          booking.status === 'cancelled' ? 'red' : 'blue'
                        }>
                          {t(booking.status) || booking.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{formatDate(booking.created_at)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>

          {/* Pilgrim Reports */}
          <Tabs.Panel value="pilgrims" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
              <Card withBorder p="md" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase">{t('total_pilgrims') || 'إجمالي المعتمرين'}</Text>
                <Text fw={700} size="xl">{reportData.pilgrims.total}</Text>
              </Card>
              <Card withBorder p="md" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase">{t('male') || 'ذكور'}</Text>
                <Text fw={700} size="xl" c="blue">{reportData.pilgrims.by_gender.male}</Text>
              </Card>
              <Card withBorder p="md" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase">{t('female') || 'إناث'}</Text>
                <Text fw={700} size="xl" c="pink">{reportData.pilgrims.by_gender.female}</Text>
              </Card>
            </SimpleGrid>

            <Paper p="md" withBorder>
              <Text fw={600} mb="md">{t('pilgrims_by_status') || 'المعتمرين حسب الحالة'}</Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                    <Table.Th>{t('count') || 'العدد'}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {reportData.pilgrims.by_status.map((item) => (
                    <Table.Tr key={item.status}>
                      <Table.Td>{t(item.status) || item.status}</Table.Td>
                      <Table.Td>{item.count}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>

          {/* Operational Reports */}
          <Tabs.Panel value="operations" pt="md">
            <SimpleGrid cols={{ base: 1, md: 2 }} mb="lg">
              <Paper p="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Text fw={600}>{t('accommodation_occupancy') || 'إشغال السكن'}</Text>
                  <Hotel size={24} />
                </Group>
                <Text size="sm" c="dimmed" mb="sm">
                  {t('occupancy_rate') || 'معدل الإشغال'}: {reportData.accommodations.occupancy_rate.toFixed(1)}%
                </Text>
                <Text size="sm" mb="md">
                  {reportData.accommodations.occupied_rooms} / {reportData.accommodations.total_rooms} {t('rooms') || 'غرف'}
                </Text>
                <Divider my="sm" />
                <Text fw={500} size="sm" mb="sm">{t('by_hotel') || 'حسب الفندق'}:</Text>
                <Stack gap="xs">
                  {reportData.accommodations.by_hotel.map((hotel) => (
                    <Group key={hotel.name} justify="space-between">
                      <Text size="sm">{hotel.name}</Text>
                      <Badge variant="light">
                        {hotel.occupied}/{hotel.total}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Text fw={600}>{t('flights') || 'الرحلات'}</Text>
                  <Plane size={24} />
                </Group>
                <Group mb="md">
                  <div>
                    <Text size="xs" c="dimmed">{t('total_flights') || 'إجمالي الرحلات'}</Text>
                    <Text fw={700} size="lg">{reportData.flights.total}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">{t('direct') || 'مباشر'}</Text>
                    <Text fw={700} size="lg" c="green">{reportData.flights.direct}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">{t('indirect') || 'غير مباشر'}</Text>
                    <Text fw={700} size="lg" c="orange">{reportData.flights.indirect}</Text>
                  </div>
                </Group>
                <Divider my="sm" />
                <Text fw={500} size="sm" mb="sm">{t('by_season') || 'حسب الموسم'}:</Text>
                <Stack gap="xs">
                  {reportData.flights.by_season.map((item) => (
                    <Group key={item.season_name} justify="space-between">
                      <Text size="sm">{item.season_name}</Text>
                      <Badge variant="light">{item.count}</Badge>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            </SimpleGrid>
          </Tabs.Panel>
        </Tabs>
      ) : (
        <Paper p="xl" withBorder>
          <Text ta="center" c="dimmed">{t('no_data') || 'لا توجد بيانات'}</Text>
        </Paper>
      )}

      {/* Handover Modals */}
      <HandoverFormModal
        opened={handoverFormOpened}
        onClose={() => setHandoverFormOpened(false)}
        onSuccess={() => {
          setHandoverRefreshTrigger(prev => prev + 1);
          fetchFinancialStatus();
        }}
        defaultType={defaultHandoverType}
        salesAmount={financialStatus?.balance?.net_balance != null && financialStatus.balance.net_balance > 0 ? financialStatus.balance.net_balance : 0}
        expenseAmount={financialStatus?.summary.total_purchases || 0}
        seasonId={selectedSeason}
      />

      <HandoverStatusModal
        opened={handoverDetailsOpened}
        onClose={() => {
          setHandoverDetailsOpened(false);
          setSelectedHandoverId(null);
        }}
        onStatusChanged={() => {
          setHandoverRefreshTrigger(prev => prev + 1);
          fetchFinancialStatus();
        }}
        handoverId={selectedHandoverId}
        isAdmin={isAdmin}
      />
    </Stack>
  );
}

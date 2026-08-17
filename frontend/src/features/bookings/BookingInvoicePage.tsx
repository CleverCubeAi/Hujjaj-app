import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Table,
  Divider,
  LoadingOverlay,
  Alert,
  Box
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';
import { ArrowRight, Printer, Download } from 'lucide-react';
import { useBranding } from '../../providers/BrandingProvider';

interface InvoiceItem {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  pilgrim_id?: string;
}

interface Invoice {
  booking: {
    id: string;
    booking_number: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    remaining_balance: number;
    created_at: string;
    clients?: {
      full_name: string;
      full_name_ar?: string;
      phone: string;
    };
    seasons?: {
      name: string;
    };
  };
  items: InvoiceItem[];
  payments: any[];
}

export function BookingInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const branding = useBranding();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [agencyBrand, setAgencyBrand] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
    api.getSessionBranding().then(setAgencyBrand).catch(() => undefined);
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const data = await api.getBookingInvoice(id!);
      console.log('Invoice data:', data);
      
      // Handle the response format - it might be the full booking object
      if (data) {
        setInvoice({
          booking: {
            id: data.id,
            booking_number: data.booking_number,
            status: data.status,
            total_amount: data.calculated_total ?? data.total_amount ?? 0,
            paid_amount: data.calculated_paid ?? data.paid_amount ?? 0,
            remaining_balance: data.calculated_remaining ?? data.remaining_balance ?? 0,
            created_at: data.created_at,
            clients: data.clients,
            seasons: data.seasons
          },
          items: data.invoice_items || [],
          payments: data.payments || []
        });
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!id) return;
    
    setDownloading(true);
    try {
      await api.downloadInvoicePDF(id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('pdf_downloaded') || 'تم تحميل الفاتورة بنجاح',
        color: 'green'
      });
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || t('pdf_download_error') || 'خطأ في تحميل الفاتورة',
        color: 'red'
      });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!invoice) {
    return (
      <Alert color="red">
        {t('invoice_not_found') || 'الفاتورة غير موجودة'}
      </Alert>
    );
  }

  const { booking, items, payments } = invoice;

  return (
    <Stack gap="lg">
      <Group justify="space-between" className="no-print">
        <Group>
          <Button variant="subtle" onClick={() => navigate(`/bookings/${id}`)} leftSection={<ArrowRight size={18} />}>
            {t('back') || 'رجوع'}
          </Button>
          <Title order={2}>{t('invoice') || 'الفاتورة'}</Title>
        </Group>
        <Group>
          <Button 
            leftSection={<Download size={18} />} 
            onClick={handleDownloadPDF}
            loading={downloading}
            disabled={downloading}
            variant="light"
          >
            {t('download_pdf') || 'تحميل PDF'}
          </Button>
          <Button leftSection={<Printer size={18} />} onClick={handlePrint}>
            {t('print_invoice') || 'طباعة'}
          </Button>
        </Group>
      </Group>

      <Paper p="xl" radius="lg" style={{ backgroundColor: '#F8F6F0', border: '1px solid #E2D9C8' }} ref={printRef}>
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <div>
            {agencyBrand?.logo_url ? (
              <img src={agencyBrand.logo_url} alt={agencyBrand.name} style={{ height: 48 }} />
            ) : (
              <>
                <Title order={2} c="#C99A3D">{agencyBrand?.name_ar || agencyBrand?.name || t('app_name')}</Title>
                <Text size="sm" c="dimmed">{agencyBrand?.name}</Text>
              </>
            )}
          </div>
          <div style={{ textAlign: 'left' }}>
            <Text fw={700} size="xl">فاتورة</Text>
            <Text size="sm" c="dimmed">INVOICE</Text>
          </div>
        </Group>

        <Divider mb="lg" />

        {/* Invoice Info */}
        <Group justify="space-between" mb="xl">
          <Stack gap="xs">
            <Text fw={600}>{t('client') || 'العميل'}:</Text>
            <Text>{booking.clients?.full_name_ar || booking.clients?.full_name}</Text>
            <Text size="sm" c="dimmed">{booking.clients?.phone}</Text>
          </Stack>
          <Stack gap="xs" style={{ textAlign: 'left' }}>
            <Group gap="xs">
              <Text size="sm" c="dimmed">{t('invoice_number') || 'رقم الفاتورة'}:</Text>
              <Text fw={600}>{booking.booking_number}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">{t('date') || 'التاريخ'}:</Text>
              <Text>{new Date(booking.created_at).toLocaleDateString('en')}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">{t('season') || 'الموسم'}:</Text>
              <Text>{booking.seasons?.name}</Text>
            </Group>
          </Stack>
        </Group>

        {/* Items Table */}
        <Table mb="xl" withTableBorder withColumnBorders>
          <Table.Thead style={{ backgroundColor: '#E7F3F2' }}>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>{t('description') || 'الوصف'}</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>{t('quantity') || 'الكمية'}</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>{t('unit_price') || 'سعر الوحدة'}</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>{t('total_price') || 'المجموع'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item, idx) => (
              <Table.Tr key={item.id}>
                <Table.Td>{idx + 1}</Table.Td>
                <Table.Td>
                  <Text fw={500}>{item.description}</Text>
                  <Text size="xs" c="dimmed">{item.item_type}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{item.quantity}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{Number(item.unit_price || 0).toLocaleString('en')} MAD</Table.Td>
                <Table.Td style={{ textAlign: 'center' }} fw={500}>{Number(item.total_price || 0).toLocaleString('en')} MAD</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {/* Totals */}
        <Group justify="flex-end">
          <Box w={300}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text>{t('subtotal') || 'المجموع الفرعي'}:</Text>
                <Text fw={500}>{booking.total_amount?.toLocaleString('en')} MAD</Text>
              </Group>
              <Group justify="space-between">
                <Text c="green">{t('paid') || 'المدفوع'}:</Text>
                <Text fw={500} c="green">{booking.paid_amount?.toLocaleString('en')} MAD</Text>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text fw={700} size="lg">{t('remaining') || 'المتبقي'}:</Text>
                <Text fw={700} size="lg" c={booking.remaining_balance > 0 ? 'red' : 'green'}>
                  {booking.remaining_balance?.toLocaleString('en')} MAD
                </Text>
              </Group>
            </Stack>
          </Box>
        </Group>

        {/* Payments History */}
        {payments && payments.length > 0 && (
          <>
            <Divider my="xl" label={t('payment_history') || 'سجل الدفعات'} />
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('date') || 'التاريخ'}</Table.Th>
                  <Table.Th>{t('amount') || 'المبلغ'}</Table.Th>
                  <Table.Th>{t('payment_method') || 'طريقة الدفع'}</Table.Th>
                  <Table.Th>{t('reference') || 'المرجع'}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {payments.map((payment) => (
                  <Table.Tr key={payment.id}>
                    <Table.Td>{new Date(payment.payment_date).toLocaleDateString('en')}</Table.Td>
                    <Table.Td fw={500} c="green">{payment.amount?.toLocaleString('en')} MAD</Table.Td>
                    <Table.Td>
                      <Badge variant="light">
                        {t(payment.payment_method) || payment.payment_method}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{payment.reference || '-'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}

        {/* Footer */}
        <Divider my="xl" />
        <Text size="sm" c="dimmed" ta="center">
          {agencyBrand?.invoice_footer || (t('thank_you_trust') || 'شكراً لثقتكم بنا')}
        </Text>
        {!agencyBrand?.hide_platform_mark && (
          <Text size="xs" c="dimmed" ta="center" mt={4}>
            Powered by {i18n.language === 'fr' ? branding.app_name_fr : branding.app_name_ar}
          </Text>
        )}
      </Paper>

      <style>{`
        @media print {
          /* Hide navigation and buttons */
          .no-print,
          nav,
          aside,
          header,
          .mantine-AppShell-navbar,
          .mantine-AppShell-header,
          .mantine-AppShell-aside {
            display: none !important;
          }
          
          /* Reset body and html */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Make main content full width */
          .mantine-AppShell-main,
          main {
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            width: 100% !important;
          }
          
          /* Invoice paper styling */
          [class*="Paper"] {
            box-shadow: none !important;
            border: none !important;
            padding: 20px !important;
            margin: 0 !important;
          }
          
          /* Table styling for print */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: avoid;
          }
          
          th, td {
            padding: 8px 12px !important;
            border: 1px solid #ddd !important;
          }
          
          thead {
            background-color: #f5efe6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Text colors for print */
          .mantine-Text-root[data-c="green"],
          [style*="color: green"],
          [style*="color:#228B22"] {
            color: #228B22 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .mantine-Text-root[data-c="red"],
          [style*="color: red"],
          [style*="color:#DC143C"] {
            color: #DC143C !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Page settings */
          @page {
            size: A4;
            margin: 15mm;
          }
          
          /* Prevent page breaks inside elements */
          tr, .mantine-Group-root {
            page-break-inside: avoid;
          }
          
          /* Footer at bottom */
          .print-footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            text-align: center;
            font-size: 10px;
            color: #999;
          }
        }
        
        /* Screen styles for print preview appearance */
        @media screen {
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
          }
        }
      `}</style>
    </Stack>
  );
}

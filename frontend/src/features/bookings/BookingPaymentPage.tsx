import React, { useEffect, useState } from 'react';
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
  Card,
  NumberInput,
  Select,
  TextInput,
  Modal,
  LoadingOverlay,
  Alert,
  ActionIcon,
  Divider
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { ArrowRight, Plus, Trash2, CreditCard, CheckCircle } from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference?: string;
  notes?: string;
}

interface BookingPayment {
  booking: {
    id: string;
    booking_number: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    remaining_balance: number;
    clients?: {
      full_name: string;
      full_name_ar?: string;
    };
  };
  payments: Payment[];
}

export function BookingPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<BookingPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: 'cash',
    payment_date: new Date(),
    reference: '',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      fetchPayments();
    }
  }, [id]);

  const fetchPayments = async () => {
    try {
      const [bookingData, paymentsResponse] = await Promise.all([
        api.getBookingById(id!),
        api.getBookingPayments(id!)
      ]);
      
      // Handle payments response - could be an array or object with payments property
      const paymentsData = Array.isArray(paymentsResponse) 
        ? paymentsResponse 
        : (paymentsResponse?.payments || paymentsResponse || []);
      
      console.log('Booking data:', bookingData);
      console.log('Payments data:', paymentsData);
      
      setData({
        booking: bookingData,
        payments: paymentsData
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (paymentForm.amount <= 0) return;
    
    setSubmitting(true);
    try {
      await api.createBookingPayment(id!, {
        amount: paymentForm.amount,
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined
      });
      setModalOpen(false);
      setPaymentForm({
        amount: 0,
        payment_method: 'cash',
        payment_date: new Date(),
        reference: '',
        notes: ''
      });
      fetchPayments();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm(t('confirm_delete') || 'هل أنت متأكد من حذف هذه الدفعة؟')) return;
    
    try {
      await api.deletePaymentRecord(paymentId);
      fetchPayments();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!data) {
    return (
      <Alert color="red">
        {t('booking_not_found') || 'الحجز غير موجود'}
      </Alert>
    );
  }

  const { booking, payments } = data;
  const paymentPercentage = booking.total_amount > 0 
    ? Math.round((booking.paid_amount / booking.total_amount) * 100) 
    : 0;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" onClick={() => navigate(`/bookings/${id}`)} leftSection={<ArrowRight size={18} />}>
            {t('back') || 'رجوع'}
          </Button>
          <Title order={2}>{t('payment_history') || 'سجل الدفعات'}</Title>
          <Badge color="brown">{booking.booking_number}</Badge>
        </Group>
        <Button leftSection={<Plus size={18} />} onClick={() => {
          setPaymentForm(prev => ({ ...prev, amount: booking.remaining_balance }));
          setModalOpen(true);
        }}>
          {t('add_payment') || 'إضافة دفعة'}
        </Button>
      </Group>

      {/* Payment Summary */}
      <Card withBorder p="lg">
        <Group justify="space-between" mb="md">
          <div>
            <Text size="sm" c="dimmed">{t('client') || 'العميل'}</Text>
            <Text fw={500}>{booking.clients?.full_name_ar || booking.clients?.full_name}</Text>
          </div>
          <Badge 
            size="xl" 
            color={paymentPercentage === 100 ? 'green' : paymentPercentage > 50 ? 'yellow' : 'red'}
          >
            {paymentPercentage}% {t('paid') || 'مدفوع'}
          </Badge>
        </Group>
        
        <Divider my="md" />
        
        <Group grow>
          <Card p="md" style={{ backgroundColor: '#f5f5f5' }}>
            <Text size="sm" c="dimmed">{t('total') || 'المجموع'}</Text>
            <Text size="xl" fw={700}>{booking.total_amount?.toLocaleString('en')} د.م</Text>
          </Card>
          <Card p="md" style={{ backgroundColor: '#e8f5e9' }}>
            <Text size="sm" c="dimmed">{t('paid') || 'المدفوع'}</Text>
            <Text size="xl" fw={700} c="green">{booking.paid_amount?.toLocaleString('en')} د.م</Text>
          </Card>
          <Card p="md" style={{ backgroundColor: booking.remaining_balance > 0 ? '#ffebee' : '#e8f5e9' }}>
            <Text size="sm" c="dimmed">{t('remaining') || 'المتبقي'}</Text>
            <Text size="xl" fw={700} c={booking.remaining_balance > 0 ? 'red' : 'green'}>
              {booking.remaining_balance?.toLocaleString('en')} د.م
            </Text>
          </Card>
        </Group>

        {booking.remaining_balance === 0 && (
          <Alert color="green" mt="md" icon={<CheckCircle size={18} />}>
            {t('fully_paid') || 'تم سداد المبلغ بالكامل'}
          </Alert>
        )}
      </Card>

      {/* Payments List */}
      <Paper p="md" radius="lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFD0' }}>
        <Text fw={600} mb="md">{t('payments') || 'الدفعات'} ({payments.length})</Text>
        
        {payments.length === 0 ? (
          <Text ta="center" c="dimmed" py="xl">
            {t('no_payments') || 'لا توجد دفعات بعد'}
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>{t('date') || 'التاريخ'}</Table.Th>
                <Table.Th>{t('amount') || 'المبلغ'}</Table.Th>
                <Table.Th>{t('payment_method') || 'طريقة الدفع'}</Table.Th>
                <Table.Th>{t('reference') || 'المرجع'}</Table.Th>
                <Table.Th>{t('notes') || 'ملاحظات'}</Table.Th>
                <Table.Th>{t('actions') || 'إجراءات'}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {payments.map((payment, idx) => (
                <Table.Tr key={payment.id}>
                  <Table.Td>{idx + 1}</Table.Td>
                  <Table.Td>{new Date(payment.payment_date).toLocaleDateString('en')}</Table.Td>
                  <Table.Td>
                    <Text fw={600} c="green">{payment.amount?.toLocaleString('en')} د.م</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">
                      {t(payment.payment_method) || payment.payment_method}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{payment.reference || '-'}</Table.Td>
                  <Table.Td>{payment.notes || '-'}</Table.Td>
                  <Table.Td>
                    <ActionIcon color="red" variant="subtle" onClick={() => handleDeletePayment(payment.id)}>
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Add Payment Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('add_payment') || 'إضافة دفعة'}
        size="md"
      >
        <Stack>
          <NumberInput
            label={t('amount') || 'المبلغ'}
            placeholder="0"
            value={paymentForm.amount}
            onChange={(v) => setPaymentForm({ ...paymentForm, amount: Number(v) || 0 })}
            min={0}
            max={booking.remaining_balance}
            required
            rightSection={<Text size="sm" c="dimmed">د.م</Text>}
          />
          
          <Group grow>
            <Button 
              variant="outline" 
              size="xs"
              onClick={() => setPaymentForm({ ...paymentForm, amount: booking.remaining_balance })}
            >
              {t('full_payment') || 'دفع كامل'}
            </Button>
            <Button 
              variant="outline" 
              size="xs"
              onClick={() => setPaymentForm({ ...paymentForm, amount: Math.round(booking.remaining_balance / 2) })}
            >
              {t('half_payment') || 'نصف المبلغ'}
            </Button>
          </Group>

          <Select
            label={t('payment_method') || 'طريقة الدفع'}
            data={[
              { value: 'cash', label: t('cash') || 'نقداً' },
              { value: 'card', label: t('card') || 'بطاقة' },
              { value: 'bank_transfer', label: t('bank_transfer') || 'تحويل بنكي' },
              { value: 'check', label: t('check') || 'شيك' }
            ]}
            value={paymentForm.payment_method}
            onChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v || 'cash' })}
          />

          <DateInput
            label={t('date') || 'التاريخ'}
            value={paymentForm.payment_date}
            onChange={(v) => setPaymentForm({ ...paymentForm, payment_date: v || new Date() })}
            valueFormat="YYYY-MM-DD"
          />

          <TextInput
            label={t('reference') || 'المرجع'}
            placeholder={t('reference_placeholder') || 'رقم الشيك أو التحويل...'}
            value={paymentForm.reference}
            onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.currentTarget.value })}
          />

          <TextInput
            label={t('notes') || 'ملاحظات'}
            placeholder={t('notes_placeholder') || 'ملاحظات إضافية...'}
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.currentTarget.value })}
          />

          <Button 
            onClick={handleAddPayment} 
            loading={submitting}
            disabled={paymentForm.amount <= 0}
            leftSection={<CreditCard size={18} />}
          >
            {t('save_payment') || 'حفظ الدفعة'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

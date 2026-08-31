import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { api } from '@/src/api/endpoints';
import { downloadFile } from '@/src/api/client';
import { formatMad, statusColor } from '@/src/lib/format';
import { shareWhatsApp } from '@/src/lib/whatsapp';
import { Button, Card, Chip, Screen, SectionTitle, Skeleton, TextField } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.getBooking(id),
  });

  useEffect(() => {
    navigation.setOptions({ title: q.data?.booking_number || t('bookings') });
  }, [navigation, q.data, t]);

  const b = q.data;
  if (q.isLoading) {
    return (
      <Screen>
        <Skeleton height={160} />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <Text style={{ color: colors.danger, fontWeight: '700' }}>{(q.error as Error).message}</Text>
      </Screen>
    );
  }
  if (!b) return null;

  const remaining = Number(b.remaining_balance ?? Number(b.total_amount || 0) - Number(b.paid_amount || 0));

  const addPay = async () => {
    setBusy(true);
    try {
      await api.createPayment(b.id, { amount: Number(amount), payment_method: method, reference_number: ref || undefined });
      setAmount('');
      await q.refetch();
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    } finally {
      setBusy(false);
    }
  };

  const shareInvoice = async () => {
    const uri = await downloadFile(`/bookings/${b.id}/invoice/pdf`, `${b.booking_number}.pdf`);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  };

  return (
    <Screen scroll>
      <View style={{ gap: space.md, paddingBottom: 32 }}>
        <Card>
          <Text style={{ fontWeight: '700', color: colors.navy, fontSize: 20 }}>{b.booking_number}</Text>
          <Text style={{ color: statusColor(b.status), fontWeight: '700' }}>{t(b.status)}</Text>
          <Text style={{ color: colors.gold, fontSize: 24, fontWeight: '700' }}>{formatMad(b.total_amount)}</Text>
          <Text style={{ color: colors.navy }}>{t('collected')}: {formatMad(b.paid_amount)}</Text>
          <Text style={{ color: colors.navy }}>{t('remaining')}: {formatMad(remaining)}</Text>
        </Card>

        <SectionTitle>{t('client')}</SectionTitle>
        <Card>
          <Text style={{ color: colors.navy, fontWeight: '700' }}>{b.clients?.full_name_ar || b.clients?.full_name}</Text>
          <Text style={{ color: colors.textMuted }}>{b.clients?.phone}</Text>
        </Card>

        <SectionTitle>{t('pilgrims')}</SectionTitle>
        {(b.pilgrims || []).map((p: any) => (
          <Card key={p.id}>
            <Text style={{ color: colors.navy, fontWeight: '700' }}>{p.full_name_ar || p.full_name}</Text>
            <Text style={{ color: colors.textMuted }}>{t(p.gender)} · {p.passport_number || t('passport_optional')}</Text>
          </Card>
        ))}

        <SectionTitle>{t('trip')}</SectionTitle>
        <Card>
          <Text style={{ color: colors.navy }}>
            {b.flights?.departure_city} → {b.flights?.arrival_city} · {b.flights?.departure_date}
          </Text>
        </Card>
        <SectionTitle>{t('stay')}</SectionTitle>
        <Card>
          <Text style={{ color: colors.navy }}>{b.accommodations?.name_ar || b.accommodations?.name} · {b.accommodations?.city}</Text>
        </Card>

        <SectionTitle>{t('take_payment')}</SectionTitle>
        <TextField label={t('amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['cash', 'card', 'bank_transfer', 'check'] as const).map((m) => (
            <Chip key={m} label={t(m)} active={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>
        <TextField label={t('reference')} value={ref} onChangeText={setRef} />
        <Button label={t('add_payment')} onPress={addPay} loading={busy} disabled={!amount} />

        <Button
          label={t('call_client')}
          variant="ghost"
          onPress={() => b.clients?.phone && Linking.openURL(`tel:${b.clients.phone}`)}
        />
        <Button
          label={t('share_whatsapp')}
          variant="ghost"
          onPress={() => shareWhatsApp(`${b.booking_number} · ${t('remaining')} ${formatMad(remaining)}`)}
        />
        <Button label={t('open_invoice')} variant="ghost" onPress={shareInvoice} />
        <Button label={t('assign_rooms_web')} variant="ghost" />
      </View>
    </Screen>
  );
}

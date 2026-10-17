import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { api } from '@/src/api/endpoints';
import { downloadFile } from '@/src/api/client';
import { ApiError } from '@/src/api/client';
import { formatMad } from '@/src/lib/format';
import { Button, Card, Chip, Empty, KpiTile, Screen, SectionTitle, Skeleton, TextField } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function ReportsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [seasonId, setSeasonId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = { season_id: seasonId || undefined, date_from: from || undefined, date_to: to || undefined };
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: api.getSeasons });
  const reports = useQuery({
    queryKey: ['reports', params],
    queryFn: () => api.getReports(params),
    retry: false,
  });
  const finance = useQuery({
    queryKey: ['financial-status', params],
    queryFn: () => api.getFinancialStatus(params),
    retry: false,
  });
  const handovers = useQuery({ queryKey: ['handovers'], queryFn: api.getHandovers, retry: false });

  const blocked = reports.error instanceof ApiError && reports.error.status === 403;
  const f = reports.data?.financial;
  const unpaid = (finance.data?.sales?.details || finance.data?.salesDetails || [])
    .filter((b: any) => Number(b.remaining) > 0);

  const exportFile = async (format: 'pdf' | 'excel') => {
    const qs = new URLSearchParams();
    if (seasonId) qs.set('season_id', seasonId);
    if (from) qs.set('date_from', from);
    if (to) qs.set('date_to', to);
    qs.set('format', format);
    qs.set('tab', 'financial');
    const uri = await downloadFile(`/reports/export?${qs}`, `report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  };

  if (blocked) {
    return (
      <Screen>
        <Empty title={t('reports_unavailable')} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ gap: space.md, paddingBottom: 28 }}>
        <SectionTitle>{t('filters')}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={t('all')} active={!seasonId} onPress={() => setSeasonId('')} />
          {(seasons.data || []).map((s: any) => (
            <Chip key={s.id} label={s.name} active={seasonId === s.id} onPress={() => setSeasonId(s.id)} />
          ))}
        </View>
        <TextField label={t('from')} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
        <TextField label={t('to')} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />

        {reports.isLoading ? <Skeleton /> : f ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <KpiTile title={t('sales')} value={formatMad(f.total_revenue)} money />
            <KpiTile title={t('received')} value={formatMad(f.total_received)} money />
            <KpiTile title={t('pending_amount')} value={formatMad(f.total_pending)} money />
            <KpiTile title={t('bookings')} value={String(f.bookings_count || 0)} />
            <KpiTile title={t('average_ticket')} value={formatMad(f.average_booking_value)} money />
          </View>
        ) : null}

        <SectionTitle>{t('by_status')}</SectionTitle>
        {(reports.data?.bookings?.by_status || []).map((row: any) => (
          <Card key={row.status}>
            <Text style={{ color: colors.navy, fontWeight: '700' }}>{t(row.status)} · {row.count}</Text>
            <Text style={{ color: colors.gold }}>{formatMad(row.total)}</Text>
          </Card>
        ))}

        <SectionTitle>{t('by_season')}</SectionTitle>
        {(reports.data?.bookings?.by_season || []).map((row: any) => (
          <Card key={row.season_name}>
            <Text style={{ color: colors.navy, fontWeight: '700' }}>{row.season_name}</Text>
            <Text style={{ color: colors.gold }}>{row.count} · {formatMad(row.total)}</Text>
          </Card>
        ))}

        <SectionTitle>{t('unpaid_list')}</SectionTitle>
        {unpaid.map((b: any) => (
          <Pressable key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{b.booking_number}</Text>
              <Text style={{ color: colors.textMuted }}>{b.client_name}</Text>
              <Text style={{ color: colors.gold }}>{t('remaining')}: {formatMad(b.remaining)}</Text>
            </Card>
          </Pressable>
        ))}
        {!unpaid.length && !finance.isLoading ? <Empty title={t('no_results')} /> : null}

        {(handovers.data || []).length ? (
          <>
            <SectionTitle>{t('handovers')}</SectionTitle>
            {(handovers.data || []).slice(0, 8).map((h: any) => (
              <Card key={h.id}>
                <Text style={{ color: colors.navy, fontWeight: '700' }}>{formatMad(h.amount)} · {t(h.status || 'pending')}</Text>
              </Card>
            ))}
          </>
        ) : null}

        <Button label={t('export_pdf')} variant="ghost" onPress={() => exportFile('pdf')} />
        <Button label={t('export_excel')} variant="ghost" onPress={() => exportFile('excel')} />
      </View>
    </Screen>
  );
}

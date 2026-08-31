import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { listDrafts } from '@/src/booking/draftStore';
import { formatMad } from '@/src/lib/format';
import { Button, Card, Chip, Empty, KpiTile, Screen, SectionTitle, Skeleton } from '@/src/ui/primitives';
import { colors, radius, space } from '@/src/theme/tokens';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const drafts = useQuery({ queryKey: ['local-drafts'], queryFn: listDrafts });

  const onRefresh = useCallback(() => {
    dash.refetch();
    inbox.refetch();
    drafts.refetch();
  }, [dash, inbox, drafts]);

  const s = dash.data;
  const unread = inbox.data?.unread_count || 0;
  const bookingsCount = s
    ? (s.bookings?.total || 0) - (s.bookings?.cancelled || 0)
    : 0;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={dash.isFetching} onRefresh={onRefresh} tintColor={colors.teal} />}
      >
        <Text style={styles.h}>{t('my_numbers')}</Text>
        {dash.isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton />
            <Skeleton />
          </View>
        ) : s ? (
          <View style={styles.grid}>
            <KpiTile title={t('sales')} value={formatMad(s.financial?.totalAgreed)} money />
            <KpiTile title={t('collected')} value={formatMad(s.financial?.totalPaid)} money />
            <KpiTile title={t('outstanding')} value={formatMad(s.financial?.totalRemaining)} money />
            <KpiTile title={t('bookings')} value={String(bookingsCount)} />
            <KpiTile title={t('pilgrims')} value={String(s.pilgrims?.total || 0)} />
            <KpiTile title={t('collection_pct')} value={`${s.financial?.paymentPercentage || 0}%`} />
          </View>
        ) : (
          <Empty
            title={t('create_first_booking')}
            action={<Button label={t('new_booking')} onPress={() => router.push('/booking/new')} />}
          />
        )}

        {unread > 0 ? (
          <Pressable onPress={() => router.push('/messages')}>
            <Card>
              <Text style={{ color: colors.tealDeep, fontWeight: '700' }}>
                {t('unread_messages')}: {unread}
              </Text>
            </Card>
          </Pressable>
        ) : null}

        <SectionTitle>{t('upcoming_seasons')}</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(s?.upcomingSeasons || []).map((season: any) => (
            <Chip
              key={season.id}
              label={`${season.name} · ${t(season.type || 'omra')}`}
              onPress={() => router.push(`/seasons/${season.id}`)}
            />
          ))}
        </ScrollView>

        {(s?.inventory?.hotel || s?.inventory?.flight) ? (
          <Card>
            <SectionTitle>{t('inventory')}</SectionTitle>
            <Text style={styles.row}>
              {t('available_beds')}: {s.inventory.hotel?.availableBeds ?? '—'}
            </Text>
            <Text style={styles.row}>
              {t('available_seats')}: {s.inventory.flight?.availableSeats ?? '—'}
            </Text>
          </Card>
        ) : null}

        {(drafts.data?.length || 0) > 0 ? (
          <>
            <SectionTitle>{t('resume_draft')}</SectionTitle>
            {drafts.data!.slice(0, 3).map((d) => (
              <Pressable key={d.id} onPress={() => router.push({ pathname: '/booking/new', params: { draftId: d.id } })}>
                <Card>
                  <Text style={{ fontWeight: '700', color: colors.navy }}>{t('draft')}</Text>
                  <Text style={styles.meta}>{d.updatedAt.slice(0, 16)} · {d.pilgrims.length} {t('pilgrims')}</Text>
                </Card>
              </Pressable>
            ))}
          </>
        ) : null}

        <SectionTitle>{t('last_bookings')}</SectionTitle>
        {(s?.recentBookings || []).slice(0, 5).length === 0 && !dash.isLoading ? (
          <Empty
            title={t('create_first_booking')}
            action={<Button label={t('new_booking')} onPress={() => router.push('/booking/new')} />}
          />
        ) : (
          (s?.recentBookings || []).slice(0, 5).map((b: any) => (
            <Pressable key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
              <Card>
                <Text style={{ fontWeight: '700', color: colors.navy }}>{b.booking_number}</Text>
                <Text style={styles.meta}>{b.client_name} · {formatMad(b.total_amount)}</Text>
                <Text style={styles.meta}>{t(b.status)} · {b.season_name || ''}</Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 24, fontWeight: '700', color: colors.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { color: colors.navy, fontSize: 14, marginTop: 4 },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  pill: { backgroundColor: colors.goldSoft, borderRadius: radius.pill },
});

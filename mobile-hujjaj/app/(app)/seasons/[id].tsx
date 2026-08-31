import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { Card, Screen, SectionTitle, Skeleton } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function SeasonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const flights = useQuery({ queryKey: ['flights', id], queryFn: () => api.getFlights(id) });
  const hotels = useQuery({ queryKey: ['hotels', id], queryFn: () => api.getAccommodations(id) });
  const bookings = useQuery({ queryKey: ['bookings', id], queryFn: () => api.getBookings({ season_id: id }) });
  const seats = useQuery({
    queryKey: ['seats', id],
    queryFn: () => api.getAvailableSeats({ season_id: id }),
    retry: false,
  });
  const beds = useQuery({
    queryKey: ['beds', id],
    queryFn: () => api.getHotelInventory({ season_id: id }),
    retry: false,
  });

  useEffect(() => {
    navigation.setOptions({ title: t('program') });
  }, [navigation, t]);

  return (
    <Screen scroll>
      <View style={{ gap: space.md, paddingBottom: 24 }}>
        <Card>
          <Text style={{ color: colors.navy, fontWeight: '700' }}>
            {t('bookings')}: {(bookings.data || []).length}
          </Text>
          <Text style={{ color: colors.textMuted }}>{t('read_only')}</Text>
        </Card>
        <SectionTitle>{t('trip')}</SectionTitle>
        {flights.isLoading ? <Skeleton /> : null}
        {(flights.data || []).map((f: any) => {
          const inv = (seats.data || []).find((i: any) => i.flight_id === f.id);
          return (
            <Card key={f.id}>
              <Text style={{ fontWeight: '700', color: colors.navy }}>
                {f.departure_city} → {f.arrival_city}
              </Text>
              <Text style={{ color: colors.textMuted }}>
                {f.carrier} · {f.departure_date} / {f.return_date}
              </Text>
              <Text style={{ color: colors.gold, fontWeight: '700' }}>
                {t('remaining_seats')}: {inv?.seats_available ?? inv?.available_seats ?? '—'}
              </Text>
            </Card>
          );
        })}
        <SectionTitle>{t('stay')}</SectionTitle>
        {(hotels.data || []).map((h: any) => {
          const invs = (beds.data || []).filter((i: any) => (i.accommodation_id || i.accommodations?.id) === h.id);
          const avail = invs.reduce((s: number, i: any) => s + Number(i.beds_available || 0), 0);
          return (
            <Card key={h.id}>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{h.name_ar || h.name}</Text>
              <Text style={{ color: colors.textMuted }}>{h.city}</Text>
              <Text style={{ color: colors.gold, fontWeight: '700' }}>{t('remaining_beds')}: {avail || '—'}</Text>
              {invs.map((i: any) => (
                <Text key={i.id} style={{ color: colors.navy, marginTop: 6 }}>
                  {i.room_types?.type || t('room_type')}: {i.beds_available}
                </Text>
              ))}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

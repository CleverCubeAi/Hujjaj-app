import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { formatMad, statusColor } from '@/src/lib/format';
import { Card, Chip, Empty, Screen, TextField } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function BookingsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: api.getSeasons });
  const list = useQuery({
    queryKey: ['bookings', { search, status, seasonId }],
    queryFn: () => api.getBookings({ search: search || undefined, status: status || undefined, season_id: seasonId || undefined }),
  });

  useEffect(() => {
    navigation.setOptions({ title: t('bookings') });
  }, [navigation, t]);

  return (
    <Screen scroll>
      <View style={{ gap: space.md, paddingBottom: 24 }}>
        <TextField label={t('search')} value={search} onChangeText={setSearch} placeholder={t('search')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['', 'draft', 'confirmed', 'paid', 'cancelled'].map((s) => (
            <Chip key={s || 'all'} label={s ? t(s) : t('all')} active={status === s} onPress={() => setStatus(s)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={t('all')} active={!seasonId} onPress={() => setSeasonId('')} />
          {(seasons.data || []).map((s: any) => (
            <Chip key={s.id} label={s.name} active={seasonId === s.id} onPress={() => setSeasonId(s.id)} />
          ))}
        </View>
        {(list.data || []).map((b: any) => (
          <Pressable key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{b.booking_number}</Text>
              <Text style={{ color: colors.textMuted }}>{b.clients?.full_name_ar || b.clients?.full_name} · {b.clients?.phone}</Text>
              <Text style={{ color: statusColor(b.status), fontWeight: '700' }}>{t(b.status)}</Text>
              <Text style={{ color: colors.gold }}>{formatMad(b.total_amount)}</Text>
            </Card>
          </Pressable>
        ))}
        {!list.data?.length && !list.isLoading ? <Empty title={t('no_results')} /> : null}
      </View>
    </Screen>
  );
}

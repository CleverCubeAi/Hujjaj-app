import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { Card, Empty, Screen, SectionTitle, Skeleton } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function TripsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: api.getSeasons });

  return (
    <Screen scroll>
      <View style={{ gap: space.md }}>
        <SectionTitle>{t('program')}</SectionTitle>
        {seasons.isLoading ? <Skeleton /> : null}
        {(seasons.data || []).map((s: any) => (
          <Pressable key={s.id} onPress={() => router.push(`/seasons/${s.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{s.name}</Text>
              <Text style={{ color: colors.textMuted }}>
                {t(s.type || 'omra')} · {s.start_date} → {s.end_date} · {t(s.status || 'active')}
              </Text>
            </Card>
          </Pressable>
        ))}
        {!seasons.isLoading && !seasons.data?.length ? <Empty title={t('no_results')} /> : null}
      </View>
    </Screen>
  );
}

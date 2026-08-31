import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { listDrafts } from '@/src/booking/draftStore';
import { Button, Card, Empty, Screen, SectionTitle } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function BookTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const drafts = useQuery({ queryKey: ['local-drafts'], queryFn: listDrafts });
  const serverDrafts = useQuery({
    queryKey: ['bookings', 'draft'],
    queryFn: () => api.getBookings({ status: 'draft' }),
  });

  useFocusEffect(
    useCallback(() => {
      drafts.refetch();
      serverDrafts.refetch();
    }, [drafts, serverDrafts]),
  );

  return (
    <Screen scroll>
      <View style={{ gap: space.md }}>
        <Button label={t('start_booking')} onPress={() => router.push('/booking/new')} />
        <SectionTitle>{t('resume_draft')}</SectionTitle>
        {(drafts.data || []).map((d) => (
          <Pressable key={d.id} onPress={() => router.push({ pathname: '/booking/new', params: { draftId: d.id } })}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{t('draft')}</Text>
              <Text style={{ color: colors.textMuted }}>{d.updatedAt.slice(0, 16)}</Text>
            </Card>
          </Pressable>
        ))}
        {(serverDrafts.data || []).map((b: any) => (
          <Pressable key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{b.booking_number}</Text>
              <Text style={{ color: colors.textMuted }}>{b.clients?.full_name_ar || b.clients?.full_name}</Text>
            </Card>
          </Pressable>
        ))}
        {!drafts.data?.length && !serverDrafts.data?.length ? <Empty title={t('empty_drafts')} /> : null}
      </View>
    </Screen>
  );
}

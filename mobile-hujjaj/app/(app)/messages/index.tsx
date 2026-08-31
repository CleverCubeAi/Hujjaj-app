import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { Button, Card, Empty, Screen } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });

  useEffect(() => {
    navigation.setOptions({ title: t('messages') });
  }, [navigation, t]);

  const items = inbox.data?.items || inbox.data || [];
  const list = Array.isArray(items) ? items : [];

  return (
    <Screen scroll>
      <View style={{ gap: space.md, paddingBottom: 24 }}>
        <Button label={t('mark_seen')} variant="ghost" onPress={() => api.markInboxSeen().then(() => inbox.refetch())} />
        {list.map((item: any) => (
          <Card key={item.id}>
            <Text style={{ fontWeight: '700', color: item.unread ? colors.tealDeep : colors.navy }}>
              {item.meta?.booking_number || item.type}
            </Text>
            <Text style={{ color: colors.textMuted }}>{item.created_at}</Text>
          </Card>
        ))}
        {!list.length && !inbox.isLoading ? <Empty title={t('no_results')} /> : null}
      </View>
    </Screen>
  );
}

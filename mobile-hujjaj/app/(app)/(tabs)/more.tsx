import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookOpen, MessageSquare, Settings, UserRound, Users } from 'lucide-react-native';
import { Card, Screen } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

const items = [
  { href: '/bookings', key: 'bookings_list', Icon: BookOpen },
  { href: '/clients', key: 'clients', Icon: UserRound },
  { href: '/pilgrims', key: 'pilgrims', Icon: Users },
  { href: '/messages', key: 'messages', Icon: MessageSquare },
  { href: '/settings', key: 'settings', Icon: Settings },
] as const;

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen scroll>
      <View style={{ gap: space.sm }}>
        {items.map(({ href, key, Icon }) => (
          <Pressable key={href} onPress={() => router.push(href as any)} accessibilityRole="button" accessibilityLabel={t(key)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
              <Icon color={colors.teal} size={22} />
              <Text style={{ color: colors.navy, fontWeight: '700', fontSize: 16 }}>{t(key)}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

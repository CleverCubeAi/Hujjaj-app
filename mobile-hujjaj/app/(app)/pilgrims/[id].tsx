import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/src/api/endpoints';
import { enqueue, isOnline } from '@/src/offline/queue';
import { Button, Card, Screen, SectionTitle } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function PilgrimDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const pilgrim = useQuery({ queryKey: ['pilgrim', id], queryFn: () => api.getPilgrim(id) });
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: () => api.getBookings() });

  useEffect(() => {
    navigation.setOptions({ title: t('pilgrims') });
  }, [navigation, t]);

  const p = pilgrim.data;
  const linked = (bookings.data || []).filter((b: any) =>
    (b.pilgrims || []).some((x: any) => x.id === id) || b.id === p?.booking_id,
  );

  const upload = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const file = { uri: asset.uri, name: asset.fileName || 'passport.jpg', type: asset.mimeType || 'image/jpeg' };
    if (!(await isOnline())) {
      await enqueue({ kind: 'photo', pilgrimId: id, ...file });
      Alert.alert(t('photo_queued'));
      return;
    }
    try {
      const uploaded = await api.uploadPilgrimFile(file);
      const url = uploaded.url || uploaded.path || uploaded.file_url;
      if (url) await api.updatePilgrim(id, { passport_scan_url: url, photo_url: url });
      await pilgrim.refetch();
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    }
  };

  if (!p) return <Screen><Text style={{ color: colors.textMuted }}>{t('loading')}</Text></Screen>;

  return (
    <Screen scroll>
      <View style={{ gap: space.md }}>
        <Card>
          <Text style={{ fontWeight: '700', color: colors.navy, fontSize: 20 }}>{p.full_name_ar || p.full_name}</Text>
          <Text style={{ color: colors.textMuted }}>{t(p.gender)} · {p.passport_number || t('passport_optional')}</Text>
          <Text style={{ color: colors.textMuted }}>{p.phone}</Text>
        </Card>
        <Button label={t('upload_passport')} onPress={upload} />
        <SectionTitle>{t('linked_bookings')}</SectionTitle>
        {linked.map((b: any) => (
          <Pressable key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{b.booking_number}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

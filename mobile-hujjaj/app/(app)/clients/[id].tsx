import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { Button, Card, Screen, SectionTitle, TextField } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const client = useQuery({ queryKey: ['client', id], queryFn: () => api.getClient(id) });
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: () => api.getBookings() });
  const [form, setForm] = useState({ full_name: '', full_name_ar: '', phone: '' });

  useEffect(() => {
    navigation.setOptions({ title: t('client') });
  }, [navigation, t]);

  useEffect(() => {
    if (client.data) {
      setForm({
        full_name: client.data.full_name || '',
        full_name_ar: client.data.full_name_ar || '',
        phone: client.data.phone || '',
      });
    }
  }, [client.data]);

  const linked = (bookings.data || []).filter((b: any) => b.client_id === id || b.clients?.id === id);

  const save = async () => {
    try {
      await api.updateClient(id, form);
      await client.refetch();
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: space.md }}>
        <TextField label={t('full_name')} value={form.full_name} onChangeText={(full_name) => setForm({ ...form, full_name })} autoCapitalize="words" />
        <TextField label={t('full_name_ar')} value={form.full_name_ar} onChangeText={(full_name_ar) => setForm({ ...form, full_name_ar })} autoCapitalize="words" />
        <TextField label={t('phone')} value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
        <Button label={t('save')} onPress={save} />
        <SectionTitle>{t('linked_bookings')}</SectionTitle>
        {linked.map((b: any) => (
          <Pressable key={b.id} onPress={() => router.push(`/bookings/${b.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{b.booking_number}</Text>
              <Text style={{ color: colors.textMuted }}>{t(b.status)}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

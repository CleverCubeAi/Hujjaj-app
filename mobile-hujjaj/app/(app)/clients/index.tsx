import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { Button, Card, Empty, Screen, TextField } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function ClientsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: '', full_name_ar: '', phone: '' });
  const list = useQuery({
    queryKey: ['clients', search],
    queryFn: () => api.getClients(search || undefined),
  });

  useEffect(() => {
    navigation.setOptions({ title: t('clients') });
  }, [navigation, t]);

  const create = async () => {
    try {
      const c = await api.createClient(form);
      setForm({ full_name: '', full_name_ar: '', phone: '' });
      setCreating(false);
      await list.refetch();
      router.push(`/clients/${c.id}`);
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: space.md, paddingBottom: 24 }}>
        <TextField label={t('search')} value={search} onChangeText={setSearch} />
        <Button label={t('new_client')} variant="ghost" onPress={() => setCreating((v) => !v)} />
        {creating ? (
          <Card>
            <TextField label={t('full_name')} value={form.full_name} onChangeText={(full_name) => setForm({ ...form, full_name })} autoCapitalize="words" />
            <View style={{ height: 8 }} />
            <TextField label={t('full_name_ar')} value={form.full_name_ar} onChangeText={(full_name_ar) => setForm({ ...form, full_name_ar })} autoCapitalize="words" />
            <View style={{ height: 8 }} />
            <TextField label={t('phone')} value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
            <View style={{ height: 12 }} />
            <Button label={t('create')} onPress={create} />
          </Card>
        ) : null}
        {(list.data || []).map((c: any) => (
          <Pressable key={c.id} onPress={() => router.push(`/clients/${c.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{c.full_name_ar || c.full_name}</Text>
              <Text style={{ color: colors.textMuted }}>{c.phone}</Text>
            </Card>
          </Pressable>
        ))}
        {!list.data?.length && !list.isLoading ? <Empty title={t('no_results')} /> : null}
      </View>
    </Screen>
  );
}

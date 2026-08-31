import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/endpoints';
import { Card, Empty, Screen, TextField } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function PilgrimsList() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const list = useQuery({ queryKey: ['pilgrims'], queryFn: () => api.getPilgrims() });

  useEffect(() => {
    navigation.setOptions({ title: t('pilgrims') });
  }, [navigation, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = list.data || [];
    if (!q) return rows;
    return rows.filter((p: any) =>
      [p.full_name, p.full_name_ar, p.passport_number, p.phone].some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [list.data, search]);

  return (
    <Screen scroll>
      <View style={{ gap: space.md, paddingBottom: 24 }}>
        <TextField label={t('search')} value={search} onChangeText={setSearch} />
        {filtered.map((p: any) => (
          <Pressable key={p.id} onPress={() => router.push(`/pilgrims/${p.id}`)}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.navy }}>{p.full_name_ar || p.full_name}</Text>
              <Text style={{ color: colors.textMuted }}>{t(p.gender || 'male')} · {p.passport_number || '—'}</Text>
            </Card>
          </Pressable>
        ))}
        {!filtered.length && !list.isLoading ? <Empty title={t('no_results')} /> : null}
      </View>
    </Screen>
  );
}

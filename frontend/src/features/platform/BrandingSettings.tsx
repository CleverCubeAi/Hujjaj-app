import { useEffect, useState } from 'react';
import {
  Paper, Stack, TextInput, Button, Title, Group, Text, ColorInput, SimpleGrid, Image, Box,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';
import { useBranding } from '../../providers/BrandingProvider';

const DEFAULTS = { primary_color: '#8B7355', accent_color: '#6F5C45' };

export function BrandingSettings() {
  const { t, i18n } = useTranslation();
  const live = useBranding();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    app_name: 'Hujjaj',
    app_name_ar: 'حجاج',
    app_name_fr: 'Hujjaj',
    tagline_ar: '',
    tagline_fr: '',
    logo_url: '',
    logo_mark_url: '',
    favicon_url: '',
    login_background_url: '',
    primary_color: DEFAULTS.primary_color,
    accent_color: DEFAULTS.accent_color,
    support_email: '',
    support_phone: '',
    default_locale: 'ar',
    legal_name: '',
    copyright: '',
  });

  const load = async () => {
    const data = await api.getPlatformBranding();
    setForm({
      app_name: data.app_name || 'Hujjaj',
      app_name_ar: data.app_name_ar || 'حجاج',
      app_name_fr: data.app_name_fr || 'Hujjaj',
      tagline_ar: data.tagline_ar || '',
      tagline_fr: data.tagline_fr || '',
      logo_url: data.logo_url || '',
      logo_mark_url: data.logo_mark_url || '',
      favicon_url: data.favicon_url || '',
      login_background_url: data.login_background_url || '',
      primary_color: data.primary_color || DEFAULTS.primary_color,
      accent_color: data.accent_color || DEFAULTS.accent_color,
      support_email: data.support_email || '',
      support_phone: data.support_phone || '',
      default_locale: data.default_locale || 'ar',
      legal_name: data.legal_name || '',
      copyright: data.copyright || '',
    });
  };

  useEffect(() => { load().catch(() => undefined); }, []);

  const upload = async (kind: string, file: File) => {
    const result = await api.uploadPlatformBranding(file, kind);
    setForm((f) => ({ ...f, [`${kind === 'background' ? 'login_background' : kind}_url`]: result.url } as any));
    if (kind === 'logo') setForm((f) => ({ ...f, logo_url: result.url }));
    if (kind === 'mark') setForm((f) => ({ ...f, logo_mark_url: result.url }));
    if (kind === 'favicon') setForm((f) => ({ ...f, favicon_url: result.url }));
    if (kind === 'background') setForm((f) => ({ ...f, login_background_url: result.url }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updatePlatformBranding(form);
      notifications.show({ title: t('success'), message: t('branding_saved') || 'Saved', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const previewName = i18n.language === 'fr' ? form.app_name_fr : form.app_name_ar;

  return (
    <Paper p="xl">
      <Title order={3} mb="md">{t('platform_branding') || 'العلامة'}</Title>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Stack>
          <TextInput label={t('app_name')} value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.currentTarget.value })} />
          <TextInput label={`${t('app_name')} (AR)`} value={form.app_name_ar} onChange={(e) => setForm({ ...form, app_name_ar: e.currentTarget.value })} />
          <TextInput label={`${t('app_name')} (FR)`} value={form.app_name_fr} onChange={(e) => setForm({ ...form, app_name_fr: e.currentTarget.value })} />
          <TextInput label={t('tagline_ar') || 'الشعار بالعربية'} value={form.tagline_ar} onChange={(e) => setForm({ ...form, tagline_ar: e.currentTarget.value })} />
          <TextInput label={t('tagline_fr') || 'Slogan FR'} value={form.tagline_fr} onChange={(e) => setForm({ ...form, tagline_fr: e.currentTarget.value })} />
          <ColorInput label={t('primary_color') || 'اللون الرئيسي'} value={form.primary_color} onChange={(v) => setForm({ ...form, primary_color: v })} />
          <ColorInput label={t('accent_color') || 'اللون الثانوي'} value={form.accent_color} onChange={(v) => setForm({ ...form, accent_color: v })} />
          <Group>
            <Button variant="default" onClick={() => setForm({ ...form, ...DEFAULTS })}>
              {t('reset_colors') || 'إعادة الألوان'}
            </Button>
          </Group>
          <TextInput label={t('support_email') || 'بريد الدعم'} value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.currentTarget.value })} />
          <TextInput label={t('support_phone') || 'هاتف الدعم'} value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.currentTarget.value })} />
          <TextInput label={t('legal_name') || 'الاسم القانوني'} value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.currentTarget.value })} />
          <TextInput label={t('copyright') || 'حقوق النشر'} value={form.copyright} onChange={(e) => setForm({ ...form, copyright: e.currentTarget.value })} />
        </Stack>
        <Stack>
          <Paper p="md" style={{ background: form.primary_color, color: 'white' }}>
            <Group>
              {form.logo_url ? <Image src={form.logo_url} h={36} w="auto" /> : null}
              <div>
                <Text fw={700}>{previewName || live.app_name}</Text>
                <Text size="sm">{i18n.language === 'fr' ? form.tagline_fr : form.tagline_ar}</Text>
              </div>
            </Group>
          </Paper>
          {(['logo', 'mark', 'favicon', 'background'] as const).map((kind) => (
            <Box key={kind}>
              <Text size="sm" fw={500} mb={4}>{t(`branding_${kind}`) || kind}</Text>
              <input type="file" accept="image/*,.svg,.ico" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(kind, file).catch((err) => notifications.show({ title: t('error'), message: err.message, color: 'red' }));
              }} />
            </Box>
          ))}
          <Button color="brown" loading={saving} onClick={save}>{t('save')}</Button>
        </Stack>
      </SimpleGrid>
    </Paper>
  );
}

import { SegmentedControl } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { brand } from '../../theme/brand';

export function LanguageSwitcher({
  variant = 'default',
}: {
  variant?: 'default' | 'on-dark' | 'on-ivory';
}) {
  const { i18n } = useTranslation();
  const onDark = variant === 'on-dark';
  const onIvory = variant === 'on-ivory';

  return (
    <SegmentedControl
      value={i18n.language}
      onChange={(value) => i18n.changeLanguage(value)}
      data={[
        { label: 'العربية', value: 'ar' },
        { label: 'Français', value: 'fr' },
      ]}
      size="sm"
      color={onDark || onIvory ? undefined : 'teal'}
      styles={
        onDark
          ? {
              root: {
                backgroundColor: 'rgba(248, 246, 240, 0.1)',
                border: `1px solid ${brand.gold}73`,
              },
              indicator: {
                backgroundColor: brand.teal,
              },
              label: {
                color: brand.ivory,
                fontWeight: 600,
              },
            }
          : onIvory
            ? {
                root: {
                  backgroundColor: brand.ivory,
                  border: `1px solid ${brand.border}`,
                },
                indicator: {
                  backgroundColor: brand.teal,
                },
                label: {
                  color: brand.navy,
                  fontWeight: 600,
                },
              }
            : {
                root: {
                  backgroundColor: '#F8F6F0',
                  border: `1px solid ${brand.border}`,
                },
              }
      }
    />
  );
}

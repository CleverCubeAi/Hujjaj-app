import { SegmentedControl } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <SegmentedControl
      value={i18n.language}
      onChange={(value) => i18n.changeLanguage(value)}
      data={[
        { label: 'العربية', value: 'ar' },
        { label: 'Français', value: 'fr' },
      ]}
      size="sm"
      color="brown"
      styles={{
        root: {
          backgroundColor: '#FEFBF6',
          border: '1px solid #E8DFD0',
        }
      }}
    />
  );
}

import { UnstyledButton, Group, Text, Box } from '@mantine/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

type IconType = ComponentType<{ size?: string | number; strokeWidth?: number; color?: string }>;

interface CustomMenuItemProps {
  to: string;
  label: string;
  icon: IconType;
  active: boolean;
  onClick: () => void;
  nested?: boolean;
}

export function CustomMenuItem({ to, label, icon: Icon, active, onClick, nested }: CustomMenuItemProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <UnstyledButton
      component={Link}
      to={to}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: nested ? '8px 12px' : '12px 16px',
        borderRadius: '12px',
        backgroundColor: active ? brand.gold : 'transparent',
        color: active ? brand.navy : 'rgba(255, 255, 255, 0.8)',
        transition: 'background-color 0.2s ease',
      }}
    >
      <Group wrap="nowrap" justify="space-between">
        <Group wrap="nowrap" gap="sm">
          <Icon size={20} strokeWidth={1.5} color={active ? brand.navy : 'rgba(255, 255, 255, 0.8)'} />
          <Text size={nested ? 'sm' : 'md'} fw={active ? 600 : 500}>
            {label}
          </Text>
        </Group>
        {isRtl ? (
          <ChevronLeft size={16} strokeWidth={2} color={active ? brand.navy : 'rgba(255, 255, 255, 0.4)'} />
        ) : (
          <ChevronRight size={16} strokeWidth={2} color={active ? brand.navy : 'rgba(255, 255, 255, 0.4)'} />
        )}
      </Group>
    </UnstyledButton>
  );
}

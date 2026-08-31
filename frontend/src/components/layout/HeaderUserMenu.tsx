import { Avatar, Box, Menu, Text, UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, User } from 'lucide-react';
import { brand } from '../../theme/brand';

export function HeaderUserMenu({
  name,
  roleLabel,
  avatarUrl,
  initial,
  onLogout,
}: {
  name: string;
  roleLabel: string;
  avatarUrl?: string;
  initial: string;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Menu shadow="lg" width={220} position="bottom-end" radius="md">
      <Menu.Target>
        <UnstyledButton
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 6px',
            borderRadius: 12,
          }}
        >
          <Avatar src={avatarUrl} color="teal" radius="xl" size="md">
            {initial}
          </Avatar>
          <Box visibleFrom="sm">
            <Text size="sm" fw={700} c={brand.navy} lh={1.2}>
              {name}
            </Text>
            <Text size="xs" c={brand.muted}>{roleLabel}</Text>
          </Box>
          <ChevronDown size={16} color={brand.muted} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown style={{ backgroundColor: brand.ivory, borderColor: brand.border }}>
        <Menu.Item
          leftSection={<User size={16} />}
          onClick={() => navigate('/settings?tab=profile')}
        >
          {t('profile')}
        </Menu.Item>
        <Menu.Item
          leftSection={<KeyRound size={16} />}
          onClick={() => navigate('/settings?tab=profile&section=password')}
        >
          {t('change_password')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<LogOut size={16} />}
          onClick={onLogout}
        >
          {t('logout')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

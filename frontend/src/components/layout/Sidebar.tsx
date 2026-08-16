import { useState, useEffect, type ComponentType } from 'react';
import { NavLink, Stack, Divider, Text, Box, Collapse } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Sun,
  Plane,
  Hotel,
  Users,
  CreditCard,
  Settings,
  FileText,
  MessageSquare,
  UserCircle,
  CalendarCheck,
  PackagePlus,
  ChevronDown,
  ChevronRight,
  BedDouble,
  Building2,
  Boxes,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { brand } from '../../theme/brand';

type IconType = ComponentType<{ size?: string | number; strokeWidth?: number; color?: string }>;

function navStyles(active: boolean, nested = false) {
  return {
    root: {
      borderRadius: 16,
      fontWeight: active ? 600 : 500,
      padding: nested ? '6px 10px' : '10px 12px',
      backgroundColor: active ? brand.gold : 'transparent',
      color: active ? brand.navy : 'rgba(248,246,240,0.88)',
      '&:hover': {
        backgroundColor: active ? brand.goldLight : 'rgba(248,246,240,0.06)',
      },
    },
    label: {
      fontSize: nested ? 12 : 13,
      color: 'inherit',
    },
    section: { color: 'inherit' },
  };
}

function iconColor(active: boolean) {
  return active ? brand.navy : 'rgba(248,246,240,0.72)';
}

function Item({
  to,
  label,
  icon: Icon,
  active,
  onClick,
  nested,
}: {
  to: string;
  label: string;
  icon: IconType;
  active: boolean;
  onClick: () => void;
  nested?: boolean;
}) {
  return (
    <NavLink
      component={Link}
      to={to}
      label={label}
      rightSection={<Icon size="1rem" strokeWidth={1.5} color={iconColor(active)} />}
      active={active}
      onClick={onClick}
      styles={navStyles(active, nested)}
    />
  );
}

function MosqueMotif() {
  return (
    <Box px="xs" pb="sm" style={{ opacity: 0.4, pointerEvents: 'none' }}>
      <svg viewBox="0 0 220 72" width="100%" height="72" fill="none" aria-hidden>
        <path d="M20 68 C50 48, 80 48, 110 68 C140 48, 170 48, 200 68" stroke={brand.gold} strokeWidth="1.4" />
        <path d="M30 68 C58 40, 90 40, 110 68" stroke={brand.goldLight} strokeWidth="1.2" />
        <path d="M110 68 C130 38, 162 38, 190 68" stroke={brand.gold} strokeWidth="1.2" />
        <path d="M48 68 V38" stroke={brand.gold} strokeWidth="1.3" />
        <circle cx="48" cy="34" r="3" fill={brand.gold} />
        <path d="M110 68 V28" stroke={brand.gold} strokeWidth="1.4" />
        <path d="M96 44 Q110 22 124 44 Z" fill={brand.gold} opacity="0.85" />
        <path d="M172 68 V36" stroke={brand.goldLight} strokeWidth="1.3" />
        <circle cx="172" cy="32" r="3" fill={brand.goldLight} />
      </svg>
    </Box>
  );
}

export function Sidebar({ closeMobile }: { closeMobile: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { role } = useAuth();
  const path = location.pathname;
  const isSuperAdmin = role === 'super_admin';

  const [bookingsExpanded, setBookingsExpanded] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [inventoryExpanded, setInventoryExpanded] = useState(false);

  useEffect(() => {
    if (path.startsWith('/bookings') || path.startsWith('/clients') || path.startsWith('/pilgrims')) {
      setBookingsExpanded(true);
    }
    if (path.startsWith('/services') || path.startsWith('/flights') || path.startsWith('/accommodations') || path.startsWith('/seasons')) {
      setConfigExpanded(true);
    }
    if (path.startsWith('/inventory')) {
      setInventoryExpanded(true);
    }
  }, [path]);

  const bookingGroupLinks = [
    { label: t('bookings') || 'الحجوزات', icon: CalendarCheck, link: '/bookings' },
    { label: t('clients') || 'العملاء', icon: UserCircle, link: '/clients' },
    { label: t('pilgrims') || 'المعتمرين', icon: Users, link: '/pilgrims' },
  ];

  const configGroupLinks = [
    { label: t('extra_services') || 'خدمات إضافية', icon: PackagePlus, link: '/services' },
    { label: t('flights') || 'الرحلات', icon: Plane, link: '/flights' },
    { label: t('accommodations') || 'السكن', icon: Hotel, link: '/accommodations' },
    { label: t('seasons') || 'المواسم', icon: Sun, link: '/seasons' },
  ];

  const settingsLinks = [
    { label: t('settings') || 'الإعدادات', icon: Settings, link: '/settings' },
    { label: t('reports') || 'التقارير', icon: FileText, link: '/reports' },
    { label: t('messages') || 'الرسائل', icon: MessageSquare, link: '/messages' },
  ];

  const isBookingGroupActive = path.startsWith('/bookings') || path.startsWith('/clients') || path.startsWith('/pilgrims');
  const isConfigGroupActive = path.startsWith('/services') || path.startsWith('/flights') || path.startsWith('/accommodations') || path.startsWith('/seasons');
  const divider = <Divider my="xs" color="rgba(248,246,240,0.08)" />;

  if (isSuperAdmin) {
    return (
      <Stack gap={4} h="100%">
        <Item to="/" label={t('dashboard')} icon={LayoutDashboard} active={path === '/'} onClick={closeMobile} />
        <Item to="/agencies" label={t('agencies') || 'الوكالات'} icon={Building2} active={path === '/agencies' || path.startsWith('/agencies/')} onClick={closeMobile} />
        <Item to="/packages" label={t('packages') || 'الباقات'} icon={Boxes} active={path === '/packages'} onClick={closeMobile} />
        <Item to="/payments" label={t('payments') || 'المدفوعات'} icon={Wallet} active={path === '/payments'} onClick={closeMobile} />
        <Box style={{ flex: 1 }} />
        {divider}
        <Item to="/settings" label={t('settings') || 'الإعدادات'} icon={Settings} active={path === '/settings'} onClick={closeMobile} />
        <MosqueMotif />
      </Stack>
    );
  }

  return (
    <Stack gap={4} h="100%">
      <Item to="/" label={t('dashboard')} icon={LayoutDashboard} active={path === '/'} onClick={closeMobile} />
      {divider}

      <NavLink
        label={t('bookings_management') || 'إدارة الحجوزات'}
        rightSection={bookingsExpanded
          ? <ChevronDown size="0.9rem" color={iconColor(isBookingGroupActive)} />
          : <ChevronRight size="0.9rem" color={iconColor(isBookingGroupActive)} />}
        active={isBookingGroupActive}
        onClick={() => setBookingsExpanded(!bookingsExpanded)}
        styles={navStyles(isBookingGroupActive)}
      />
      <Collapse in={bookingsExpanded}>
        <Stack gap={2} ps="sm">
          {bookingGroupLinks.map((item) => (
            <Item
              key={item.link}
              to={item.link}
              label={item.label}
              icon={item.icon}
              nested
              active={path === item.link || (path.startsWith(item.link) && item.link !== '/')}
              onClick={closeMobile}
            />
          ))}
        </Stack>
      </Collapse>

      {divider}

      <NavLink
        label={t('configuration') || 'الإعدادات والتكوين'}
        rightSection={configExpanded
          ? <ChevronDown size="0.9rem" color={iconColor(isConfigGroupActive)} />
          : <ChevronRight size="0.9rem" color={iconColor(isConfigGroupActive)} />}
        active={isConfigGroupActive}
        onClick={() => setConfigExpanded(!configExpanded)}
        styles={navStyles(isConfigGroupActive)}
      />
      <Collapse in={configExpanded}>
        <Stack gap={2} ps="sm">
          {configGroupLinks.map((item) => (
            <Item
              key={item.link}
              to={item.link}
              label={item.label}
              icon={item.icon}
              nested
              active={path === item.link || (path.startsWith(item.link) && item.link !== '/')}
              onClick={closeMobile}
            />
          ))}
        </Stack>
      </Collapse>

      {divider}

      <NavLink
        label={t('inventory') || 'المخزون'}
        rightSection={inventoryExpanded
          ? <ChevronDown size="0.9rem" color={iconColor(path.startsWith('/inventory'))} />
          : <ChevronRight size="0.9rem" color={iconColor(path.startsWith('/inventory'))} />}
        active={path.startsWith('/inventory')}
        onClick={() => setInventoryExpanded(!inventoryExpanded)}
        styles={navStyles(path.startsWith('/inventory'))}
      />
      <Collapse in={inventoryExpanded}>
        <Stack gap={2} ps="sm">
          <Item
            to="/inventory/hotel-rooms"
            label={t('hotel_beds') || 'أسرة الفنادق'}
            icon={BedDouble}
            nested
            active={path === '/inventory/hotel-rooms' || path.startsWith('/inventory/hotel-rooms')}
            onClick={closeMobile}
          />
          <Item
            to="/inventory/flight-seats"
            label={t('flight_seats') || 'مقاعد الطائرات'}
            icon={Plane}
            nested
            active={path === '/inventory/flight-seats' || path.startsWith('/inventory/flight-seats')}
            onClick={closeMobile}
          />
        </Stack>
      </Collapse>

      {divider}

      <Item
        to="/expenses"
        label={t('expenses')}
        icon={CreditCard}
        active={path === '/expenses' || path.startsWith('/expenses')}
        onClick={closeMobile}
      />

      <Box style={{ flex: 1 }} />

      {divider}

      <Text size="xs" fw={600} px="xs" tt="uppercase" c="rgba(248,246,240,0.45)" style={{ letterSpacing: '0.04em' }}>
        {t('settings') || 'الإعدادات'}
      </Text>
      {settingsLinks.map((item) => (
        <Item
          key={item.link}
          to={item.link}
          label={item.label}
          icon={item.icon}
          active={path === item.link}
          onClick={closeMobile}
        />
      ))}
      <MosqueMotif />
    </Stack>
  );
}

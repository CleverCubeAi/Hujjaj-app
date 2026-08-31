import { useState, type ComponentType } from 'react';
import { Stack, Text, Box, Collapse, UnstyledButton, Group, ScrollArea, Divider } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Sun, Plane, Hotel, Users, CreditCard, Settings,
  FileText, MessageSquare, UserCircle, CalendarCheck, PackagePlus,
  ChevronDown, ChevronLeft, ChevronRight, BedDouble, Building2, Boxes, Wallet, Shield
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import sidebarBg from '../../assets/img/sidebar-bg.png';

type IconType = ComponentType<{ size?: string | number; strokeWidth?: number; color?: string }>;

const colors = {
  deepTeal: '#063F46',
  emerald: '#0C7774',
  darkNavy: '#071D35',
  luxuryGold: '#C99A3D',
  lightGold: '#E5C46A',
  ivory: '#F8F6F0',
  warmSand: '#EEE9DD',
};

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  onClick,
  nested,
  hasSubmenu,
  expanded,
  onToggle,
}: {
  to?: string;
  label: string;
  icon: IconType;
  active: boolean;
  onClick?: () => void;
  nested?: boolean;
  hasSubmenu?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const content = (
    <Group wrap="nowrap" justify="space-between" style={{ width: '100%' }}>
      <Group wrap="nowrap" gap="md">
        <Icon 
          size={nested ? 18 : 20} 
          strokeWidth={1.5} 
          color={active ? colors.lightGold : (isHovered ? colors.ivory : 'rgba(248, 246, 240, 0.5)')} 
          style={{ transition: 'color 0.2s ease' }}
        />
        <Text 
          size={nested ? 'sm' : 'sm'} 
          fw={active ? 600 : 400} 
          c={active ? colors.ivory : (isHovered ? colors.ivory : 'rgba(248, 246, 240, 0.7)')}
          style={{ transition: 'color 0.2s ease', letterSpacing: '0.2px' }}
        >
          {label}
        </Text>
      </Group>
      {hasSubmenu && (
        expanded ? 
          <ChevronDown size={16} color={active ? colors.lightGold : 'rgba(248, 246, 240, 0.4)'} /> : 
          (isRtl ? 
            <ChevronLeft size={16} color={active ? colors.lightGold : 'rgba(248, 246, 240, 0.4)'} /> : 
            <ChevronRight size={16} color={active ? colors.lightGold : 'rgba(248, 246, 240, 0.4)'} />
          )
      )}
    </Group>
  );

  const style = {
    display: 'block',
    width: '100%',
    padding: nested ? (isRtl ? '10px 32px 10px 16px' : '10px 16px 10px 32px') : '12px 16px',
    margin: '2px 0',
    borderRadius: '12px',
    background: active ? 'rgba(12, 119, 116, 0.3)' : (isHovered ? 'rgba(248, 246, 240, 0.04)' : 'transparent'),
    borderInlineStart: active ? `3px solid ${colors.luxuryGold}` : '3px solid transparent',
    boxShadow: active ? (isRtl ? 'inset -10px 0 20px -10px rgba(201, 154, 61, 0.15)' : 'inset 10px 0 20px -10px rgba(201, 154, 61, 0.15)') : 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    textAlign: (isRtl ? 'right' : 'left') as const,
  };

  if (hasSubmenu) {
    return (
      <UnstyledButton 
        onClick={onToggle} 
        style={style}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {content}
      </UnstyledButton>
    );
  }

  return (
    <UnstyledButton
      component={Link}
      to={to!}
      onClick={onClick}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {content}
    </UnstyledButton>
  );
}

export function Sidebar({ closeMobile }: { closeMobile: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { role } = useAuth();
  const path = location.pathname;
  const isSuperAdmin = role === 'super_admin';

  const [bookingsExpanded, setBookingsExpanded] = useState(() => path.startsWith('/bookings') || path.startsWith('/clients') || path.startsWith('/pilgrims'));
  const [configExpanded, setConfigExpanded] = useState(() => path.startsWith('/services') || path.startsWith('/flights') || path.startsWith('/accommodations') || path.startsWith('/seasons'));
  const [inventoryExpanded, setInventoryExpanded] = useState(() => path.startsWith('/inventory'));
  const [adminExpanded, setAdminExpanded] = useState(() => path.startsWith('/reports') || path.startsWith('/messages'));

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

  const adminGroupLinks = [
    { label: t('reports') || 'التقارير', icon: FileText, link: '/reports' },
    { label: t('messages') || 'الرسائل', icon: MessageSquare, link: '/messages' },
  ];

  const isBookingGroupActive = path.startsWith('/bookings') || path.startsWith('/clients') || path.startsWith('/pilgrims');
  const isConfigGroupActive = path.startsWith('/services') || path.startsWith('/flights') || path.startsWith('/accommodations') || path.startsWith('/seasons');
  const isAdminGroupActive = path.startsWith('/reports') || path.startsWith('/messages');
  
  const divider = <Divider my="sm" color="rgba(229, 196, 106, 0.08)" />;

  const renderNavItems = () => {
    if (isSuperAdmin) {
      return (
        <Stack gap={4}>
          <NavItem to="/" label={t('dashboard')} icon={LayoutDashboard} active={path === '/'} onClick={closeMobile} />
          <NavItem to="/agencies" label={t('agencies') || 'الوكالات'} icon={Building2} active={path === '/agencies' || path.startsWith('/agencies/')} onClick={closeMobile} />
          <NavItem to="/packages" label={t('packages') || 'الباقات'} icon={Boxes} active={path === '/packages'} onClick={closeMobile} />
          <NavItem to="/payments" label={t('payments') || 'المدفوعات'} icon={Wallet} active={path === '/payments'} onClick={closeMobile} />
        </Stack>
      );
    }

    return (
      <Stack gap={4}>
        <NavItem to="/" label={t('dashboard')} icon={LayoutDashboard} active={path === '/'} onClick={closeMobile} />
        
        <NavItem
          label={t('bookings_management') || 'إدارة الحجوزات'}
          icon={CalendarCheck}
          hasSubmenu
          expanded={bookingsExpanded}
          active={isBookingGroupActive}
          onToggle={() => setBookingsExpanded(!bookingsExpanded)}
        />
        <Collapse in={bookingsExpanded}>
          <Stack gap={2} ps="sm" pe="xs">
            {bookingGroupLinks.map((item) => (
              <NavItem
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

        <NavItem
          label={t('configuration') || 'الإعدادات والتكوين'}
          icon={Settings}
          hasSubmenu
          expanded={configExpanded}
          active={isConfigGroupActive}
          onToggle={() => setConfigExpanded(!configExpanded)}
        />
        <Collapse in={configExpanded}>
          <Stack gap={2} ps="sm" pe="xs">
            {configGroupLinks.map((item) => (
              <NavItem
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

        <NavItem
          label={t('inventory') || 'المخزون'}
          icon={Boxes}
          hasSubmenu
          expanded={inventoryExpanded}
          active={path.startsWith('/inventory')}
          onToggle={() => setInventoryExpanded(!inventoryExpanded)}
        />
        <Collapse in={inventoryExpanded}>
          <Stack gap={2} ps="sm" pe="xs">
            <NavItem
              to="/inventory/hotel-rooms"
              label={t('hotel_beds') || 'أسرة الفنادق'}
              icon={BedDouble}
              nested
              active={path === '/inventory/hotel-rooms' || path.startsWith('/inventory/hotel-rooms')}
              onClick={closeMobile}
            />
            <NavItem
              to="/inventory/flight-seats"
              label={t('flight_seats') || 'مقاعد الطائرات'}
              icon={Plane}
              nested
              active={path === '/inventory/flight-seats' || path.startsWith('/inventory/flight-seats')}
              onClick={closeMobile}
            />
          </Stack>
        </Collapse>

        <NavItem
          to="/expenses"
          label={t('expenses')}
          icon={CreditCard}
          active={path === '/expenses' || path.startsWith('/expenses')}
          onClick={closeMobile}
        />

        <NavItem
          label={t('administration') || 'الإدارة'}
          icon={Shield}
          hasSubmenu
          expanded={adminExpanded}
          active={isAdminGroupActive}
          onToggle={() => setAdminExpanded(!adminExpanded)}
        />
        <Collapse in={adminExpanded}>
          <Stack gap={2} ps="sm" pe="xs">
            {adminGroupLinks.map((item) => (
              <NavItem
                key={item.link}
                to={item.link}
                label={item.label}
                icon={item.icon}
                nested
                active={path === item.link || path.startsWith(item.link)}
                onClick={closeMobile}
              />
            ))}
          </Stack>
        </Collapse>
      </Stack>
    );
  };

  const renderSettings = () => {
    if (isSuperAdmin) {
      return (
        <Stack gap={4}>
          <NavItem to="/settings" label={t('settings') || 'الإعدادات'} icon={Settings} active={path === '/settings'} onClick={closeMobile} />
        </Stack>
      );
    }

    return (
      <Stack gap={4}>
        <NavItem
          to="/settings"
          label={t('settings') || 'الإعدادات'}
          icon={Settings}
          active={path === '/settings' || path.startsWith('/settings')}
          onClick={closeMobile}
        />
      </Stack>
    );
  };

  return (
    <Box pos="relative" h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: colors.darkNavy }}>
      {/* Background Image Layer */}
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${sidebarBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'bottom center',
          opacity: 0.85,
          zIndex: 0,
        }}
      />
      {/* Atmospheric Gradient Overlay */}
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${colors.darkNavy} 0%, rgba(7,29,53,0.75) 40%, ${colors.deepTeal} 100%)`,
          opacity: 0.9,
          zIndex: 1,
        }}
      />

      {/* Content Layer */}
      <Box style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <ScrollArea style={{ flex: 1 }} type="scroll" scrollbars="y" offsetScrollbars>
          <Box p="md" pt="xl">
            {renderNavItems()}
          </Box>
        </ScrollArea>
        <Box p="md" pt={0} style={{ flexShrink: 0 }}>
          {divider}
          {renderSettings()}
        </Box>
      </Box>
    </Box>
  );
}

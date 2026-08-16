import { useState, useEffect } from 'react';
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
  Wallet
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

export function Sidebar({ closeMobile }: { closeMobile: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { role } = useAuth();
  const path = location.pathname;
  const isSuperAdmin = role === 'super_admin';

  // State for expanded menu groups
  const [bookingsExpanded, setBookingsExpanded] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [inventoryExpanded, setInventoryExpanded] = useState(false);

  // Auto-expand groups if current path matches
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

  // Issue #1 fix: use t() instead of hardcoded Arabic
  const settingsLinks = [
    { label: t('settings') || 'الإعدادات', icon: Settings, link: '/settings' },
    { label: t('reports') || 'التقارير', icon: FileText, link: '/reports' },
    { label: t('messages') || 'الرسائل', icon: MessageSquare, link: '/messages' },
  ];

  const isBookingGroupActive = path.startsWith('/bookings') || path.startsWith('/clients') || path.startsWith('/pilgrims');
  const isConfigGroupActive = path.startsWith('/services') || path.startsWith('/flights') || path.startsWith('/accommodations') || path.startsWith('/seasons');

  const navLinkStyles = {
    root: {
      borderRadius: 6,
      fontWeight: 500,
      padding: '8px 12px',
    },
    label: {
      fontSize: '13px',
    }
  };

  if (isSuperAdmin) {
    return (
      <Stack gap={4} h="100%">
        <NavLink
          component={Link}
          to="/"
          label={t('dashboard')}
          rightSection={<LayoutDashboard size="1rem" strokeWidth={1.5} />}
          active={path === '/'}
          onClick={closeMobile}
          styles={navLinkStyles}
        />
        <NavLink
          component={Link}
          to="/agencies"
          label={t('agencies') || 'الوكالات'}
          rightSection={<Building2 size="1rem" strokeWidth={1.5} />}
          active={path === '/agencies' || path.startsWith('/agencies/')}
          onClick={closeMobile}
          styles={navLinkStyles}
        />
        <NavLink
          component={Link}
          to="/packages"
          label={t('packages') || 'الباقات'}
          rightSection={<Boxes size="1rem" strokeWidth={1.5} />}
          active={path === '/packages'}
          onClick={closeMobile}
          styles={navLinkStyles}
        />
        <NavLink
          component={Link}
          to="/payments"
          label={t('payments') || 'المدفوعات'}
          rightSection={<Wallet size="1rem" strokeWidth={1.5} />}
          active={path === '/payments'}
          onClick={closeMobile}
          styles={navLinkStyles}
        />
        <Box style={{ flex: 1 }} />
        <Divider my="xs" />
        <NavLink
          component={Link}
          to="/settings"
          label={t('settings') || 'الإعدادات'}
          rightSection={<Settings size="1rem" strokeWidth={1.5} />}
          active={path === '/settings'}
          onClick={closeMobile}
          styles={navLinkStyles}
        />
      </Stack>
    );
  }

  return (
    <Stack gap={4} h="100%">
      {/* Dashboard */}
      <NavLink
        component={Link}
        to="/"
        label={t('dashboard')}
        rightSection={<LayoutDashboard size="1rem" strokeWidth={1.5} />}
        active={path === '/'}
        onClick={closeMobile}
        styles={navLinkStyles}
      />

      <Divider my="xs" />

      {/* Bookings & Clients Group */}
      <NavLink
        label={t('bookings_management') || 'إدارة الحجوزات'}
        rightSection={bookingsExpanded ? <ChevronDown size="0.9rem" /> : <ChevronRight size="0.9rem" />}
        active={isBookingGroupActive}
        onClick={() => setBookingsExpanded(!bookingsExpanded)}
        styles={navLinkStyles}
      />
      <Collapse in={bookingsExpanded}>
        <Stack gap={2} pl="sm">
          {bookingGroupLinks.map((item) => (
            <NavLink
              key={item.link}
              component={Link}
              to={item.link}
              label={item.label}
              rightSection={<item.icon size="1rem" strokeWidth={1.5} />}
              active={path === item.link || (path.startsWith(item.link) && item.link !== '/')}
              onClick={closeMobile}
              styles={{
                root: {
                  borderRadius: 6,
                  fontWeight: 500,
                  padding: '6px 10px',
                  marginLeft: '4px',
                },
                label: {
                  fontSize: '12px',
                }
              }}
            />
          ))}
        </Stack>
      </Collapse>

      <Divider my="xs" />

      {/* Configuration Group */}
      <NavLink
        label={t('configuration') || 'الإعدادات والتكوين'}
        rightSection={configExpanded ? <ChevronDown size="0.9rem" /> : <ChevronRight size="0.9rem" />}
        active={isConfigGroupActive}
        onClick={() => setConfigExpanded(!configExpanded)}
        styles={navLinkStyles}
      />
      <Collapse in={configExpanded}>
        <Stack gap={2} pl="sm">
          {configGroupLinks.map((item) => (
            <NavLink
              key={item.link}
              component={Link}
              to={item.link}
              label={item.label}
              rightSection={<item.icon size="1rem" strokeWidth={1.5} />}
              active={path === item.link || (path.startsWith(item.link) && item.link !== '/')}
              onClick={closeMobile}
              styles={{
                root: {
                  borderRadius: 6,
                  fontWeight: 500,
                  padding: '6px 10px',
                  marginLeft: '4px',
                },
                label: {
                  fontSize: '12px',
                }
              }}
            />
          ))}
        </Stack>
      </Collapse>

      <Divider my="xs" />

      {/* Inventory Group */}
      <NavLink
        label={t('inventory') || 'المخزون'}
        rightSection={inventoryExpanded ? <ChevronDown size="0.9rem" /> : <ChevronRight size="0.9rem" />}
        active={path.startsWith('/inventory')}
        onClick={() => setInventoryExpanded(!inventoryExpanded)}
        styles={navLinkStyles}
      />
      <Collapse in={inventoryExpanded}>
        <Stack gap={2} pl="sm">
          <NavLink
            component={Link}
            to="/inventory/hotel-rooms"
            label={t('hotel_beds') || 'أسرة الفنادق'}
            rightSection={<BedDouble size="1rem" strokeWidth={1.5} />}
            active={path === '/inventory/hotel-rooms' || path.startsWith('/inventory/hotel-rooms')}
            onClick={closeMobile}
            styles={{
              root: {
                borderRadius: 6,
                fontWeight: 500,
                padding: '6px 10px',
                marginLeft: '4px',
              },
              label: {
                fontSize: '12px',
              }
            }}
          />
          <NavLink
            component={Link}
            to="/inventory/flight-seats"
            label={t('flight_seats') || 'مقاعد الطائرات'}
            rightSection={<Plane size="1rem" strokeWidth={1.5} />}
            active={path === '/inventory/flight-seats' || path.startsWith('/inventory/flight-seats')}
            onClick={closeMobile}
            styles={{
              root: {
                borderRadius: 6,
                fontWeight: 500,
                padding: '6px 10px',
                marginLeft: '4px',
              },
              label: {
                fontSize: '12px',
              }
            }}
          />
        </Stack>
      </Collapse>

      <Divider my="xs" />

      {/* Expenses */}
      <NavLink
        component={Link}
        to="/expenses"
        label={t('expenses')}
        rightSection={<CreditCard size="1rem" strokeWidth={1.5} />}
        active={path === '/expenses' || path.startsWith('/expenses')}
        onClick={closeMobile}
        styles={navLinkStyles}
      />
      
      <Box style={{ flex: 1 }} />
      
      <Divider my="xs" />
      
      <Text size="xs" fw={600} c="dimmed" px="xs" tt="uppercase">
        {t('settings') || 'الإعدادات'}
      </Text>
      {settingsLinks.map((item) => (
        <NavLink
          key={item.link}
          component={Link}
          to={item.link}
          label={item.label}
          rightSection={<item.icon size="1rem" strokeWidth={1.5} />}
          active={path === item.link}
          onClick={closeMobile}
          styles={navLinkStyles}
        />
      ))}
    </Stack>
  );
}

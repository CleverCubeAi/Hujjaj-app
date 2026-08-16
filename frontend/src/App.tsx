import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoadingOverlay, Center } from '@mantine/core';
import { Login } from './features/auth/Login';
import { AccommodationGrid } from './features/accommodations/AccommodationGrid';
import { PilgrimsPage } from './features/pilgrims/PilgrimsPage';
import { ExpensesList } from './features/expenses/ExpensesList';
import { FlightsList } from './features/flights/FlightsList';
import { SeasonsList } from './features/seasons/SeasonsList';
import { DashboardStats } from './features/dashboard/DashboardStats';
import { PlatformDashboard } from './features/platform/PlatformDashboard';
import { AgenciesPage } from './features/platform/AgenciesPage';
import { AgencyDetailPage } from './features/platform/AgencyDetailPage';
import { PackagesPage } from './features/platform/PackagesPage';
import { PaymentsPage } from './features/platform/PaymentsPage';
// Booking workflow imports
import { ClientsPage } from './features/clients/ClientsPage';
import { BookingsPage } from './features/bookings/BookingsPage';
import { BookingWizard } from './features/bookings/BookingWizard';
import { BookingDetailsPage } from './features/bookings/BookingDetailsPage';
import { BookingInvoicePage } from './features/bookings/BookingInvoicePage';
import { BookingPaymentPage } from './features/bookings/BookingPaymentPage';
import { BookingRoomsPage } from './features/bookings/BookingRoomsPage';
import { ServicesPage } from './features/services/ServicesPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { MessagesPage } from './features/messages/MessagesPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { HotelInventoryPage } from './features/inventory/HotelInventoryPage';
import { BedMapPage } from './features/inventory/BedMapPage';
import { SeatMapPage } from './features/inventory/SeatMapPage';
import FlightInventoryPage from './features/inventory/FlightInventoryPage';
import { RoleGuard } from './components/common/RoleGuard';

const AGENCY_STAFF = ['agency_admin', 'manager', 'agent'];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <Center h="100vh">
        <LoadingOverlay visible />
      </Center>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <DashboardLayout>{children}</DashboardLayout>;
}

function AgencyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleGuard allowed={AGENCY_STAFF}>{children}</RoleGuard>
    </ProtectedRoute>
  );
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleGuard allowed={['super_admin']}>{children}</RoleGuard>
    </ProtectedRoute>
  );
}

function HomePage() {
  const { role } = useAuth();
  if (role === 'super_admin') return <PlatformDashboard />;
  return <DashboardStats />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <Center h="100vh">
        <LoadingOverlay visible />
      </Center>
    );
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      
      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      } />
      <Route path="/agencies" element={
        <SuperAdminRoute>
          <AgenciesPage />
        </SuperAdminRoute>
      } />
      <Route path="/agencies/:id" element={
        <SuperAdminRoute>
          <AgencyDetailPage />
        </SuperAdminRoute>
      } />
      <Route path="/packages" element={
        <SuperAdminRoute>
          <PackagesPage />
        </SuperAdminRoute>
      } />
      <Route path="/payments" element={
        <SuperAdminRoute>
          <PaymentsPage />
        </SuperAdminRoute>
      } />
      <Route path="/seasons" element={
        <AgencyRoute>
          <SeasonsList />
        </AgencyRoute>
      } />
      <Route path="/flights" element={
        <AgencyRoute>
          <FlightsList />
        </AgencyRoute>
      } />
      <Route path="/accommodations" element={
        <AgencyRoute>
          <AccommodationGrid />
        </AgencyRoute>
      } />
      <Route path="/pilgrims" element={
        <AgencyRoute>
          <PilgrimsPage />
        </AgencyRoute>
      } />
      <Route path="/expenses" element={
        <AgencyRoute>
          <ExpensesList />
        </AgencyRoute>
      } />

      {/* Booking Workflow Routes */}
      <Route path="/clients" element={
        <AgencyRoute>
          <ClientsPage />
        </AgencyRoute>
      } />
      <Route path="/bookings" element={
        <AgencyRoute>
          <BookingsPage />
        </AgencyRoute>
      } />
      <Route path="/bookings/new" element={
        <AgencyRoute>
          <BookingWizard />
        </AgencyRoute>
      } />
      <Route path="/bookings/:id" element={
        <AgencyRoute>
          <BookingDetailsPage />
        </AgencyRoute>
      } />
      <Route path="/bookings/:id/invoice" element={
        <AgencyRoute>
          <BookingInvoicePage />
        </AgencyRoute>
      } />
      <Route path="/bookings/:id/payment" element={
        <AgencyRoute>
          <BookingPaymentPage />
        </AgencyRoute>
      } />
      <Route path="/bookings/:id/rooms" element={
        <AgencyRoute>
          <BookingRoomsPage />
        </AgencyRoute>
      } />
      <Route path="/services" element={
        <AgencyRoute>
          <ServicesPage />
        </AgencyRoute>
      } />
      <Route path="/reports" element={
        <AgencyRoute>
          <ReportsPage />
        </AgencyRoute>
      } />
      <Route path="/messages" element={
        <AgencyRoute>
          <MessagesPage />
        </AgencyRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/inventory/hotel-rooms" element={
        <AgencyRoute>
          <HotelInventoryPage />
        </AgencyRoute>
      } />
      <Route path="/inventory/hotel-rooms/:inventoryId/bed-map" element={
        <AgencyRoute>
          <BedMapPage />
        </AgencyRoute>
      } />
      <Route path="/inventory/flight-seats" element={
        <AgencyRoute>
          <FlightInventoryPage />
        </AgencyRoute>
      } />
      <Route path="/inventory/flight-seats/:inventoryId/seat-map" element={
        <AgencyRoute>
          <SeatMapPage />
        </AgencyRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

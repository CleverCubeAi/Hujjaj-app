import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoadingOverlay, Center, Text } from '@mantine/core';
import { Login } from './features/auth/Login';
import { AccommodationGrid } from './features/accommodations/AccommodationGrid';
import { PilgrimsPage } from './features/pilgrims/PilgrimsPage';
import { ExpensesList } from './features/expenses/ExpensesList';
import { FlightsList } from './features/flights/FlightsList';
import { SeasonsList } from './features/seasons/SeasonsList';
import { DashboardStats } from './features/dashboard/DashboardStats';
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
          <DashboardStats />
        </ProtectedRoute>
      } />
      <Route path="/seasons" element={
        <ProtectedRoute>
          <SeasonsList />
        </ProtectedRoute>
      } />
      <Route path="/flights" element={
        <ProtectedRoute>
          <FlightsList />
        </ProtectedRoute>
      } />
      <Route path="/accommodations" element={
        <ProtectedRoute>
          <AccommodationGrid />
        </ProtectedRoute>
      } />
      <Route path="/pilgrims" element={
        <ProtectedRoute>
          <PilgrimsPage />
        </ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute>
          <ExpensesList />
        </ProtectedRoute>
      } />

      {/* Booking Workflow Routes */}
      <Route path="/clients" element={
        <ProtectedRoute>
          <ClientsPage />
        </ProtectedRoute>
      } />
      <Route path="/bookings" element={
        <ProtectedRoute>
          <BookingsPage />
        </ProtectedRoute>
      } />
      <Route path="/bookings/new" element={
        <ProtectedRoute>
          <BookingWizard />
        </ProtectedRoute>
      } />
      <Route path="/bookings/:id" element={
        <ProtectedRoute>
          <BookingDetailsPage />
        </ProtectedRoute>
      } />
      <Route path="/bookings/:id/invoice" element={
        <ProtectedRoute>
          <BookingInvoicePage />
        </ProtectedRoute>
      } />
      <Route path="/bookings/:id/payment" element={
        <ProtectedRoute>
          <BookingPaymentPage />
        </ProtectedRoute>
      } />
      <Route path="/bookings/:id/rooms" element={
        <ProtectedRoute>
          <BookingRoomsPage />
        </ProtectedRoute>
      } />
      <Route path="/services" element={
        <ProtectedRoute>
          <ServicesPage />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute>
          <ReportsPage />
        </ProtectedRoute>
      } />
      <Route path="/messages" element={
        <ProtectedRoute>
          <MessagesPage />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/inventory/hotel-rooms" element={
        <ProtectedRoute>
          <HotelInventoryPage />
        </ProtectedRoute>
      } />
      <Route path="/inventory/hotel-rooms/:inventoryId/bed-map" element={
        <ProtectedRoute>
          <BedMapPage />
        </ProtectedRoute>
      } />
      <Route path="/inventory/flight-seats" element={
        <ProtectedRoute>
          <FlightInventoryPage />
        </ProtectedRoute>
      } />
      <Route path="/inventory/flight-seats/:inventoryId/seat-map" element={
        <ProtectedRoute>
          <SeatMapPage />
        </ProtectedRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

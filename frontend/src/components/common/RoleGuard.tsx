import React from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Navigate } from 'react-router-dom';
import { Center, Text } from '@mantine/core';

interface RoleGuardProps {
  children: React.ReactNode;
  allowed: string[];
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, allowed, fallback }: RoleGuardProps) {
  const { role, loading, user } = useAuth();

  if (loading) {
    return <Center h="100%"><Text>Loading...</Text></Center>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!role || !allowed.includes(role)) {
    return fallback ? <>{fallback}</> : <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

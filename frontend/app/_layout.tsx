import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="map" />
        <Stack.Screen name="paths" />
        <Stack.Screen name="rewards" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="assistant" />
      </Stack>
    </AuthProvider>
  );
}
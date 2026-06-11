import React from 'react';
import SenderApp from './src/SenderApp';
import DriverApp from './src/DriverApp';

export default function App() {
  // This reads the secret tag from your terminal command
  const appRole = process.env.EXPO_PUBLIC_APP_ROLE;

  // If the command specifies 'driver', load the Driver Radar
  if (appRole === 'driver') {
    return <DriverApp />;
  }

  // Otherwise, default to the Sender Portal
  return <SenderApp />;
}
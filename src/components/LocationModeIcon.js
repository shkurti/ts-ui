import React from 'react';
import { Satellite, RadioTower, Wifi } from 'lucide-react';
import { modeToggles } from '../utils/locationModes';

// Icon(s) for a tracker location mode: satellite for GPS, tower and/or WiFi
// for the network sources in use
const LocationModeIcon = ({ mode, size = 12 }) => {
  const on = modeToggles(mode);
  if (on.gps) return <Satellite size={size} />;
  return (
    <>
      {on.cell && <RadioTower size={size} />}
      {on.wifi && <Wifi size={size} />}
    </>
  );
};

export default LocationModeIcon;

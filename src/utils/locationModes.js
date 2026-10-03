// Tracker location modes, set from the Configure Tracker toggles. GPS is used
// on its own; the network sources (cell tower, WiFi) can be used alone or
// together, and any of them keeps the tracker's GPS receiver off.
//   gps        GPS only
//   cell       cell tower only
//   cell_wifi  cell tower + nearby WiFi
//   wifi       nearby WiFi only
const MODE_LABELS = {
  gps: 'GPS',
  cell: 'Cell location',
  cell_wifi: 'Cell location + WiFi',
  wifi: 'WiFi',
};

const MODE_SHORT_LABELS = {
  gps: 'GPS',
  cell: 'Cell',
  cell_wifi: 'Cell + WiFi',
  wifi: 'WiFi',
};

// Trackers that never set or reported a mode (older firmware) are on GPS
export const normalizeMode = (mode) => (MODE_LABELS[mode] ? mode : 'gps');

export const modeLabel = (mode) => MODE_LABELS[normalizeMode(mode)];
export const modeShortLabel = (mode) => MODE_SHORT_LABELS[normalizeMode(mode)];

// Which toggles are on for a mode
export const modeToggles = (mode) => {
  const m = normalizeMode(mode);
  return {
    gps: m === 'gps',
    cell: m === 'cell' || m === 'cell_wifi',
    wifi: m === 'wifi' || m === 'cell_wifi',
  };
};

// The mode after flipping one toggle. Turning GPS on turns the network
// sources off, and turning a network source on turns GPS off. Turning off
// the last source falls back to the other kind (GPS off -> cell, last
// network source off -> GPS) so the tracker always has one.
export const toggleMode = (mode, toggle) => {
  const on = modeToggles(mode);
  if (toggle === 'gps') return on.gps ? 'cell' : 'gps';
  const cell = toggle === 'cell' ? !on.cell : on.cell;
  const wifi = toggle === 'wifi' ? !on.wifi : on.wifi;
  if (cell && wifi) return 'cell_wifi';
  if (cell) return 'cell';
  if (wifi) return 'wifi';
  return 'gps';
};

// What placed one reading ("Src"): gps, or a network source with an
// accuracy radius worth drawing on the map
export const isNetworkSource = (source) => source === 'cell' || source === 'wifi';

export const sourceLabel = (source, accuracy) => {
  if (!isNetworkSource(source)) return 'GPS';
  const name = source === 'wifi' ? 'WiFi location' : 'Cell location';
  return accuracy ? `${name} (±${Math.round(accuracy)} m)` : name;
};

// Tracker location modes, set from the Configure Tracker toggles. GPS is used
// on its own; cell location keeps the tracker's GPS receiver off and can add
// nearby WiFi networks for a more precise position where they are known.
//   gps        GPS only
//   cell       cell tower only
//   cell_wifi  cell tower + nearby WiFi
const MODE_LABELS = {
  gps: 'GPS',
  cell: 'Cell location',
  cell_wifi: 'Cell location + WiFi',
};

const MODE_SHORT_LABELS = {
  gps: 'GPS',
  cell: 'Cell',
  cell_wifi: 'Cell + WiFi',
};

// Trackers that never set or reported a mode (older firmware) are on GPS
export const normalizeMode = (mode) => (MODE_LABELS[mode] ? mode : 'gps');

export const modeLabel = (mode) => MODE_LABELS[normalizeMode(mode)];
export const modeShortLabel = (mode) => MODE_SHORT_LABELS[normalizeMode(mode)];

// Which toggles are on for a mode
export const modeToggles = (mode) => {
  const m = normalizeMode(mode);
  return { gps: m === 'gps', cell: m !== 'gps', wifi: m === 'cell_wifi' };
};

// The mode after flipping one toggle. GPS and cell location replace each
// other, so the tracker always has one source. WiFi is an add-on to cell
// location: it can only be switched while cell location is on, and turning
// cell location off turns it off too.
export const toggleMode = (mode, toggle) => {
  const m = normalizeMode(mode);
  if (toggle === 'gps') return m === 'gps' ? 'cell' : 'gps';
  if (toggle === 'cell') return m === 'gps' ? 'cell' : 'gps';
  if (toggle === 'wifi' && m !== 'gps') return m === 'cell_wifi' ? 'cell' : 'cell_wifi';
  return m;
};

// What placed one reading ("Src"): gps, or a network source (cell tower or
// WiFi) with an accuracy radius worth drawing on the map
export const isNetworkSource = (source) => source === 'cell' || source === 'wifi';

export const sourceLabel = (source, accuracy) => {
  if (!isNetworkSource(source)) return 'GPS';
  const name = source === 'wifi' ? 'WiFi location' : 'Cell location';
  return accuracy ? `${name} (±${Math.round(accuracy)} m)` : name;
};

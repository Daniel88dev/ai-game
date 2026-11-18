/** "Dark Mode 24" palette from art/ART_DIRECTION.md, keyed by the single letters used in sprite grids. */
export const PALETTE: Record<string, string> = {
  k: '#14121f', // Ink (outline)
  d: '#26233a', // Night
  m: '#3b3858', // Dusk
  g: '#6e6a8f', // Slate
  l: '#9d99bd', // Fog
  w: '#e8e6f0', // Paper
  s: '#f2c6a0', // Skin
  S: '#c98f6b', // Skin shade
  h: '#5a3a2a', // Hair
  b: '#3d7bd9', // Hoodie
  B: '#2a559c', // Hoodie shade
  c: '#4fd6e0', // AI cyan
  C: '#2a9aa8', // AI cyan shade
  r: '#e5484d', // Critical
  R: '#9c2a35', // Critical shade
  o: '#f5a524', // Major
  O: '#b8641a', // Major shade
  y: '#f7e26b', // Warning
  G: '#46c46e', // Pass
  n: '#2d8a4d', // Pass shade
  p: '#a35fe0', // Merge
  P: '#6c3aa3', // Merge shade
  x: '#8a5a3c', // Wood
  X: '#5e3b26', // Wood shade
};

export const hex = (key: string): number => parseInt(PALETTE[key]!.slice(1), 16);

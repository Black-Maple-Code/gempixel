export interface LabCoordinates {
  l: number;
  a: number;
  b: number;
}

export interface DmcColor {
  dmc: string;
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  lab: LabCoordinates;
  kits: ("100" | "200")[];
}

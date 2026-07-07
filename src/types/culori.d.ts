declare module 'culori/fn' {
  export function useMode(mode: any): any;
  export const modeRgb: any;
  export const modeXyz65: any;
  export const modeLab: any;
  export const modeLab65: any;
  export function converter(mode: string): (color: any) => any;
  export function differenceCiede2000(kL?: number, kC?: number, kH?: number): (c1: any, c2: any) => number;
}

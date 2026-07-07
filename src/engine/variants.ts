export interface VariantMapping {
  200?: number;
  500?: number;
  1000?: number;
  2000?: number;
}

export type VariantLookup = Record<string, Record<'square' | 'round', VariantMapping>>;

export const DRILL_VARIANTS: VariantLookup = {
  '150': {
    square: {
      200: 29774635827314,
      500: 29774635860082,
      1000: 29774635892850,
      2000: 29774635925618
    },
    round: {
      200: 29774635958386,
      500: 29774635991154,
      1000: 29774636023922,
      2000: 29774636056690
    }
  },
  '310': {
    square: {
      200: 29774636089458,
      500: 29774636122226,
      1000: 29774636154994,
      2000: 29774636187762
    },
    round: {
      200: 29774636220530,
      500: 29774636253298,
      1000: 29774636286066,
      2000: 29774636318834
    }
  }
};

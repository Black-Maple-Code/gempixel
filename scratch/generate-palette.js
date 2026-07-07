import { useMode, modeRgb, modeXyz65, modeLab, modeLab65, converter } from 'culori/fn';
import fs from 'fs';
import path from 'path';

// Configure Culori conversion pipeline (must match src/engine/color.ts)
useMode(modeRgb);
useMode(modeXyz65);
useMode(modeLab);
useMode(modeLab65);

const toLab = converter('lab');

const bothKits = [
  { dmc: "310", name: "Black", hex: "#000000" },
  { dmc: "BLANC", name: "White", hex: "#FFFFFF" },
  { dmc: "ECRU", name: "Ecru", hex: "#F0EADA" },
  { dmc: "B5200", name: "Snow White", hex: "#FBFBFB" },
  { dmc: "150", name: "Dusty Rose UT DK", hex: "#9E1B46" },
  { dmc: "151", name: "Dusty Rose VY LT", hex: "#FBC5D4" },
  { dmc: "152", name: "Shell Pink MD LT", hex: "#E59F9C" },
  { dmc: "153", name: "Violet VY LT", hex: "#E5C2D9" },
  { dmc: "154", name: "Grape VY DK", hex: "#57142A" },
  { dmc: "155", name: "Blue Violet MD", hex: "#9C97C0" },
  { dmc: "156", name: "Blue Violet MD LT", hex: "#A4B2D5" },
  { dmc: "157", name: "Cornflower VY LT", hex: "#BBCADF" },
  { dmc: "158", name: "Cornflower MD VY DK", hex: "#445173" },
  { dmc: "159", name: "Light Blue Gray", hex: "#C6CDDB" },
  { dmc: "160", name: "Medium Blue Gray", hex: "#97A2BD" },
  { dmc: "161", name: "Gray Blue", hex: "#7381A5" },
  { dmc: "162", name: "Blue Ultra VY LT", hex: "#DBE7F4" },
  { dmc: "163", name: "Celadon Green MD", hex: "#567961" },
  { dmc: "164", name: "Celadon Green LT", hex: "#9FBEA3" },
  { dmc: "165", name: "Moss Green VY LT", hex: "#ECE9A8" },
  { dmc: "166", name: "Moss Green MD LT", hex: "#C2CC61" },
  { dmc: "167", name: "Yellow Beige VY DK", hex: "#A28659" },
  { dmc: "168", name: "Pewter VY LT", hex: "#D1D1D1" },
  { dmc: "169", name: "Pewter LT", hex: "#8A8A8A" },
  { dmc: "208", name: "Lavender VY DK", hex: "#7A4C78" },
  { dmc: "209", name: "Lavender DK", hex: "#A275A1" },
  { dmc: "210", name: "Lavender MD", hex: "#C197C0" },
  { dmc: "211", name: "Lavender LT", hex: "#E2C2E1" },
  { dmc: "221", name: "Shell Pink VY DK", hex: "#8D363B" },
  { dmc: "223", name: "Shell Pink LT", hex: "#CC8485" },
  { dmc: "224", name: "Shell Pink VY LT", hex: "#EAB8B6" },
  { dmc: "225", name: "Shell Pink UL VY LT", hex: "#FFDFDD" },
  { dmc: "300", name: "Mahogany VY DK", hex: "#753413" },
  { dmc: "301", name: "Mahogany MD", hex: "#B15E35" },
  { dmc: "304", name: "Red MD", hex: "#B91932" },
  { dmc: "307", name: "Lemon", hex: "#FEDD47" },
  { dmc: "309", name: "Rose BG", hex: "#BA163F" },
  { dmc: "311", name: "Navy Blue MD", hex: "#1F3E61" },
  { dmc: "312", name: "Baby Blue VY DK", hex: "#254B76" },
  { dmc: "315", name: "Antique Mauve VY DK", hex: "#7B4F55" },
  { dmc: "316", name: "Antique Mauve MD", hex: "#B67F88" },
  { dmc: "317", name: "Pewter Gray", hex: "#6D6D6D" },
  { dmc: "318", name: "Pewter Gray LT", hex: "#C4C4C4" },
  { dmc: "319", name: "Pistachio Green VY DK", hex: "#204A27" },
  { dmc: "320", name: "Pistachio Green MD", hex: "#68956B" },
  { dmc: "321", name: "Red", hex: "#C3223A" },
  { dmc: "322", name: "Baby Blue LT", hex: "#5687B2" },
  { dmc: "326", name: "Rose VY DK", hex: "#B11B35" },
  { dmc: "327", name: "Violet VY DK", hex: "#492659" },
  { dmc: "333", name: "Blue Violet VY DK", hex: "#5C527B" }
];

const kit100Only = [
  { dmc: "334", name: "Baby Blue MD", hex: "#7599BE" },
  { dmc: "335", name: "Rose", hex: "#D4425C" },
  { dmc: "336", name: "Navy Blue", hex: "#22385C" },
  { dmc: "340", name: "Blue Violet MD", hex: "#9191BF" },
  { dmc: "341", name: "Blue Violet LT", hex: "#ABB2D7" },
  { dmc: "347", name: "Cranberry VY DK", hex: "#C03248" },
  { dmc: "349", name: "Coral DK", hex: "#D23849" },
  { dmc: "350", name: "Coral MD", hex: "#E65A5A" },
  { dmc: "351", name: "Coral", hex: "#F0786C" },
  { dmc: "352", name: "Coral LT", hex: "#F6998C" },
  { dmc: "353", name: "Peach", hex: "#FEC3B8" },
  { dmc: "355", name: "Terra Cotta DK", hex: "#963E33" },
  { dmc: "356", name: "Terra Cotta MD", hex: "#C1695C" },
  { dmc: "367", name: "Pistachio Green DK", hex: "#38663E" },
  { dmc: "368", name: "Pistachio Green LT", hex: "#9ABEA0" },
  { dmc: "369", name: "Pistachio Green VY LT", hex: "#DBECE0" },
  { dmc: "400", name: "Mahogany DK", hex: "#8D3F1B" },
  { dmc: "402", name: "Mahogany VY LT", hex: "#F3AC7F" },
  { dmc: "407", name: "Desert Sand DK", hex: "#9C6A5A" },
  { dmc: "413", name: "Pewter Gray DK", hex: "#4E4E4E" },
  { dmc: "414", name: "Steel Gray DK", hex: "#8C8C8C" },
  { dmc: "415", name: "Pearl Gray", hex: "#DCDCDC" },
  { dmc: "420", name: "Hazelnut Brown DK", hex: "#89643B" },
  { dmc: "422", name: "Hazelnut Brown LT", hex: "#C3A17B" },
  { dmc: "433", name: "Brown MD", hex: "#7B5238" },
  { dmc: "434", name: "Brown LT", hex: "#9A6A4E" },
  { dmc: "435", name: "Brown VY LT", hex: "#B57E5C" },
  { dmc: "436", name: "Tan", hex: "#CB9C77" },
  { dmc: "437", name: "Tan LT", hex: "#E1BE9A" },
  { dmc: "444", name: "Lemon DK", hex: "#FFD600" },
  { dmc: "445", name: "Lemon LT", hex: "#FFEFA0" },
  { dmc: "451", name: "Shell Gray DK", hex: "#95847F" },
  { dmc: "452", name: "Shell Gray MD", hex: "#BCADA7" },
  { dmc: "453", name: "Shell Gray LT", hex: "#DCD4D1" },
  { dmc: "469", name: "Avocado Green", hex: "#546E3A" },
  { dmc: "470", name: "Avocado Green LT", hex: "#769C51" },
  { dmc: "471", name: "Avocado Green VY LT", hex: "#9BB77E" },
  { dmc: "472", name: "Avocado Green UL LT", hex: "#DBEB9B" },
  { dmc: "498", name: "Cranberry DK", hex: "#A2162B" },
  { dmc: "500", name: "Blue Green VY DK", hex: "#1E3F34" },
  { dmc: "501", name: "Blue Green DK", hex: "#396657" },
  { dmc: "502", name: "Blue Green MD", hex: "#598E7B" },
  { dmc: "503", name: "Blue Green LT", hex: "#83B6A3" },
  { dmc: "505", name: "Jade Green PX LT", hex: "#53A78A" },
  { dmc: "517", name: "Wedgewood DK", hex: "#376FA2" },
  { dmc: "518", name: "Wedgewood LT", hex: "#5190C1" },
  { dmc: "519", name: "Sky Blue", hex: "#7CAFD5" },
  { dmc: "520", name: "Fern Green DK", hex: "#556847" },
  { dmc: "522", name: "Fern Green LT", hex: "#94A786" },
  { dmc: "523", name: "Fern Green VY LT", hex: "#B1C2A5" }
];

const kit200Only = [
  { dmc: "524", name: "Fern Green VY LT", hex: "#BDCDA8" },
  { dmc: "535", name: "Ash Gray VY DK", hex: "#616157" },
  { dmc: "543", name: "Potato Brown UL LT", hex: "#EADCC8" },
  { dmc: "550", name: "Violet VY DK", hex: "#4F1D5A" },
  { dmc: "552", name: "Violet MD", hex: "#81378B" },
  { dmc: "553", name: "Violet LT", hex: "#A262AA" },
  { dmc: "554", name: "Violet VY LT", hex: "#DABFDC" },
  { dmc: "561", name: "Jade Green VY DK", hex: "#255845" },
  { dmc: "562", name: "Jade Green MD", hex: "#3F8161" },
  { dmc: "563", name: "Jade Green LT", hex: "#70AD8E" },
  { dmc: "564", name: "Jade Green VY LT", hex: "#A6D7BC" },
  { dmc: "580", name: "Moss Green DK", hex: "#758428" },
  { dmc: "581", name: "Moss Green LT", hex: "#9EAF39" },
  { dmc: "597", name: "Turquoise", hex: "#5796A6" },
  { dmc: "598", name: "Turquoise LT", hex: "#8FBFC8" },
  { dmc: "600", name: "Cranberry VY DK", hex: "#C41453" },
  { dmc: "601", name: "Cranberry DK", hex: "#CE386B" },
  { dmc: "602", name: "Cranberry MD", hex: "#E05D8E" },
  { dmc: "603", name: "Cranberry LT", hex: "#FF9EB7" },
  { dmc: "604", name: "Cranberry VY LT", hex: "#FFC5D3" },
  { dmc: "605", name: "Cranberry UL VY LT", hex: "#FFEBEF" },
  { dmc: "606", name: "Bright Orange Red", hex: "#FF3A00" },
  { dmc: "608", name: "Bright Orange", hex: "#FF6A00" },
  { dmc: "610", name: "Drab Brown DK", hex: "#765C43" },
  { dmc: "611", name: "Drab Brown MD", hex: "#8D765C" },
  { dmc: "612", name: "Drab Brown LT", hex: "#BCAB91" },
  { dmc: "613", name: "Drab Brown VY LT", hex: "#DCD2BE" },
  { dmc: "632", name: "Cocoa UL DK", hex: "#5E402D" },
  { dmc: "640", name: "Beaver Gray VY DK", hex: "#7E7969" },
  { dmc: "642", name: "Beaver Gray DK", hex: "#9D9783" },
  { dmc: "644", name: "Beaver Gray MD", hex: "#D7D2C5" },
  { dmc: "645", name: "Beaver Gray VY DK", hex: "#6F6F68" },
  { dmc: "646", name: "Beaver Gray DK", hex: "#8D8D85" },
  { dmc: "647", name: "Beaver Gray MD", hex: "#BCBCB4" },
  { dmc: "648", name: "Beaver Gray LT", hex: "#DCDCD4" },
  { dmc: "666", name: "Bright Red", hex: "#E21C38" },
  { dmc: "676", name: "Old Gold LT", hex: "#E7CE97" },
  { dmc: "677", name: "Old Gold VY LT", hex: "#F0E7CE" },
  { dmc: "680", name: "Old Gold DK", hex: "#BB8F3B" },
  { dmc: "699", name: "Christmas Green", hex: "#1A5A2B" },
  { dmc: "700", name: "Christmas Green BG", hex: "#0B7228" },
  { dmc: "701", name: "Christmas Green LT", hex: "#368E3E" },
  { dmc: "702", name: "Kelly Green", hex: "#47A941" },
  { dmc: "703", name: "Chartreuse", hex: "#78C041" },
  { dmc: "704", name: "Chartreuse LT", hex: "#9FE14D" },
  { dmc: "712", name: "Cream", hex: "#FAF5E6" },
  { dmc: "718", name: "Plum", hex: "#9E1B62" },
  { dmc: "720", name: "Rust DK", hex: "#B74F2A" },
  { dmc: "721", name: "Medium Orange Spice", hex: "#D66A3D" },
  { dmc: "722", name: "Light Orange Spice", hex: "#EE9B74" },
  { dmc: "725", name: "Topaz MD LT", hex: "#F3BA45" },
  { dmc: "726", name: "Topaz LT", hex: "#FADA5F" },
  { dmc: "727", name: "Topaz VY LT", hex: "#FFF3B1" },
  { dmc: "728", name: "Topaz", hex: "#E4A22F" },
  { dmc: "729", name: "Old Gold MD", hex: "#C89F43" },
  { dmc: "730", name: "Olive Green VY DK", hex: "#5B5927" },
  { dmc: "731", name: "Olive Green DK", hex: "#6F6D2F" },
  { dmc: "732", name: "Olive Green", hex: "#8D8B3B" },
  { dmc: "733", name: "Olive Green MD", hex: "#A7A547" },
  { dmc: "734", name: "Olive Green LT", hex: "#C3C170" },
  { dmc: "738", name: "Tan VY LT", hex: "#E7CBA5" },
  { dmc: "739", name: "Tan UL VY LT", hex: "#F5E8D7" },
  { dmc: "740", name: "Tangerine", hex: "#FF8E00" },
  { dmc: "741", name: "Tangerine MD", hex: "#FFA600" },
  { dmc: "742", name: "Tangerine LT", hex: "#FFC149" },
  { dmc: "743", name: "Yellow MD", hex: "#FFE276" },
  { dmc: "744", name: "Yellow Pale", hex: "#FFF297" },
  { dmc: "745", name: "Yellow Pale LT", hex: "#FFFBC6" },
  { dmc: "746", name: "Off White", hex: "#FCFBE3" },
  { dmc: "747", name: "Sky Blue VY LT", hex: "#E6F5F6" },
  { dmc: "754", name: "Peach LT", hex: "#F6C1B4" },
  { dmc: "758", name: "Terra Cotta VY LT", hex: "#EAA89A" },
  { dmc: "760", name: "Salmon", hex: "#E5978E" },
  { dmc: "761", name: "Salmon LT", hex: "#ECC1BB" },
  { dmc: "762", name: "Pearl Gray VY LT", hex: "#ECECEC" },
  { dmc: "772", name: "Yellow Green LT", hex: "#E2ECBD" },
  { dmc: "775", name: "Baby Blue VY LT", hex: "#DCEBF4" },
  { dmc: "776", name: "Pink MD", hex: "#FEADB6" },
  { dmc: "777", name: "Plum VY DK", hex: "#861F38" },
  { dmc: "778", name: "Cocoa LT", hex: "#DCA6B4" },
  { dmc: "779", name: "Cocoa DK", hex: "#654D4F" },
  { dmc: "780", name: "Topaz UL VY DK", hex: "#96601D" },
  { dmc: "781", name: "Topaz VY DK", hex: "#A86F28" },
  { dmc: "782", name: "Topaz DK", hex: "#B87B2E" },
  { dmc: "783", name: "Topaz MD", hex: "#CB8C3B" },
  { dmc: "791", name: "Cornflower UL DK", hex: "#2E2E61" },
  { dmc: "792", name: "Cornflower DK", hex: "#495186" },
  { dmc: "793", name: "Cornflower MD", hex: "#6871A5" },
  { dmc: "794", name: "Cornflower LT", hex: "#8E9AC6" },
  { dmc: "796", name: "Royal Blue DK", hex: "#0F3F73" },
  { dmc: "797", name: "Royal Blue", hex: "#154D8C" },
  { dmc: "798", name: "Delft Blue DK", hex: "#39669A" },
  { dmc: "799", name: "Delft Blue MD", hex: "#5681B2" },
  { dmc: "800", name: "Delft Blue Pale", hex: "#C0D3EB" },
  { dmc: "801", name: "Coffee Brown DK", hex: "#613E22" },
  { dmc: "803", name: "Baby Blue UL DK", hex: "#1F4770" },
  { dmc: "807", name: "Peacock Blue", hex: "#337D8D" },
  { dmc: "809", name: "Delft Blue", hex: "#82A2CB" },
  { dmc: "813", name: "Blue LT", hex: "#6EA1CD" },
  { dmc: "814", name: "Garnet DK", hex: "#761427" },
  { dmc: "815", name: "Garnet MD", hex: "#831F2E" },
  { dmc: "816", name: "Garnet", hex: "#932637" },
  { dmc: "817", name: "Red VY DK", hex: "#BC162B" },
  { dmc: "818", name: "Baby Pink", hex: "#FFDFDF" },
  { dmc: "819", name: "Baby Pink LT", hex: "#FFEBEB" },
  { dmc: "820", name: "Royal Blue VY DK", hex: "#072C59" },
  { dmc: "822", name: "Light Sand", hex: "#E5DEC9" },
  { dmc: "823", name: "Navy Blue DK", hex: "#112244" },
  { dmc: "824", name: "Blue VY DK", hex: "#32618D" },
  { dmc: "825", name: "Blue DK", hex: "#3E77AA" },
  { dmc: "826", name: "Blue MD", hex: "#5B97C9" },
  { dmc: "827", name: "Blue VY LT", hex: "#BBD7EC" },
  { dmc: "828", name: "Blue UL VY LT", hex: "#D5ECF8" },
  { dmc: "829", name: "Golden Olive VY DK", hex: "#75612D" },
  { dmc: "830", name: "Golden Olive DK", hex: "#867035" },
  { dmc: "831", name: "Golden Olive MD", hex: "#988141" },
  { dmc: "832", name: "Golden Olive", hex: "#AE954F" },
  { dmc: "833", name: "Golden Olive LT", hex: "#CBB675" },
  { dmc: "834", name: "Golden Olive VY LT", hex: "#E2C889" },
  { dmc: "838", name: "Beaver Brown VY DK", hex: "#4C3A2B" },
  { dmc: "839", name: "Beaver Brown DK", hex: "#5C4C3E" },
  { dmc: "840", name: "Beaver Brown MD", hex: "#7B6654" },
  { dmc: "841", name: "Beaver Brown LT", hex: "#9E8C7A" },
  { dmc: "842", name: "Beaver Brown VY LT", hex: "#C3B5A5" },
  { dmc: "844", name: "Beaver Gray UL DK", hex: "#3F3F3E" },
  { dmc: "869", name: "Hazelnut Brown", hex: "#866138" },
  { dmc: "890", name: "Pistachio UL DK", hex: "#13381B" },
  { dmc: "891", name: "Carnation DK", hex: "#FE5778" },
  { dmc: "892", name: "Carnation MD", hex: "#FE7D95" },
  { dmc: "893", name: "Carnation LT", hex: "#FE9BB2" },
  { dmc: "894", name: "Carnation VY LT", hex: "#FEBDCC" },
  { dmc: "895", name: "Hunter Green VY DK", hex: "#1D3A1B" },
  { dmc: "898", name: "Coffee Brown VY DK", hex: "#4D321A" },
  { dmc: "899", name: "Rose MD", hex: "#F4738B" },
  { dmc: "900", name: "Burnt Orange DK", hex: "#D24416" },
  { dmc: "902", name: "Garnet UL DK", hex: "#611325" },
  { dmc: "904", name: "Parrot Green VY DK", hex: "#396613" },
  { dmc: "905", name: "Parrot Green DK", hex: "#4E8620" },
  { dmc: "906", name: "Parrot Green MD", hex: "#63A62B" },
  { dmc: "907", name: "Parrot Green LT", hex: "#8FCB45" },
  { dmc: "909", name: "Emerald Green VY DK", hex: "#165B39" },
  { dmc: "910", name: "Emerald Green DK", hex: "#1E744E" },
  { dmc: "911", name: "Emerald Green MD", hex: "#2A9064" },
  { dmc: "912", name: "Emerald Green LT", hex: "#53B38D" },
  { dmc: "913", name: "Nile Green MD", hex: "#70C6A0" },
  { dmc: "915", name: "Plum DK", hex: "#8D164B" },
  { dmc: "917", name: "Plum MD", hex: "#A72061" },
  { dmc: "918", name: "Red Copper DK", hex: "#893B1F" },
  { dmc: "919", name: "Red Copper MD", hex: "#A24E2B" },
  { dmc: "920", name: "Copper MD", hex: "#B75D35" }
];

// 1. Combine into a unified database with membership tags
const unified = [];
const seen = new Set();

const addColor = (color, is100, is200) => {
  if (seen.has(color.dmc)) {
    // If we've seen it, find it and update kits
    const existing = unified.find(c => c.dmc === color.dmc);
    if (is100 && !existing.kits.includes("100")) existing.kits.push("100");
    if (is200 && !existing.kits.includes("200")) existing.kits.push("200");
  } else {
    seen.add(color.dmc);
    const kits = [];
    if (is100) kits.push("100");
    if (is200) kits.push("200");
    unified.push({
      ...color,
      kits
    });
  }
};

bothKits.forEach(c => addColor(c, true, true));
kit100Only.forEach(c => addColor(c, true, false));
kit200Only.forEach(c => addColor(c, false, true));

// Validate sizes
const count100 = unified.filter(c => c.kits.includes("100")).length;
const count200 = unified.filter(c => c.kits.includes("200")).length;

console.log(`Validation:`);
console.log(`- Unique colors count: ${unified.length}`);
console.log(`- Kit 100 colors count: ${count100} (Expected: 100)`);
console.log(`- Kit 200 colors count: ${count200} (Expected: 200)`);

if (count100 !== 100) {
  throw new Error(`Kit 100 size validation failed: expected 100, got ${count100}`);
}
if (count200 !== 200) {
  throw new Error(`Kit 200 size validation failed: expected 200, got ${count200}`);
}

// 2. Pre-calculate CIELAB D50 coordinates
const processed = unified.map(color => {
  // Parse hex to RGB components
  const rComponent = parseInt(color.hex.slice(1, 3), 16);
  const gComponent = parseInt(color.hex.slice(3, 5), 16);
  const bComponent = parseInt(color.hex.slice(5, 7), 16);

  // Culori expects r, g, b values in range [0.0, 1.0]
  const lab = toLab({ mode: 'rgb', r: rComponent / 255, g: gComponent / 255, b: bComponent / 255 });

  return {
    dmc: color.dmc,
    name: color.name,
    hex: color.hex,
    r: rComponent,
    g: gComponent,
    b: bComponent,
    lab: {
      l: parseFloat(lab.l !== undefined ? lab.l.toFixed(4) : "0"),
      a: parseFloat(lab.a !== undefined ? lab.a.toFixed(4) : "0"),
      b: parseFloat(lab.b !== undefined ? lab.b.toFixed(4) : "0")
    },
    kits: color.kits
  };
});

// Sort output numerically (or alphabetically for non-numeric codes like BLANC)
processed.sort((x, y) => {
  const xNum = parseInt(x.dmc, 10);
  const yNum = parseInt(y.dmc, 10);
  if (isNaN(xNum) && isNaN(yNum)) {
    return x.dmc.localeCompare(y.dmc);
  }
  if (isNaN(xNum)) return 1; // BLANC/ECRU go to end
  if (isNaN(yNum)) return -1;
  return xNum - yNum;
});

// 3. Write palette.ts file content
const outputDir = path.resolve('src/engine');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'palette.ts');

const tsContent = `import { DmcColor } from './types';

/**
 * Unified DMC reference catalog containing pre-calculated CIELAB coordinates
 * and kit membership metadata for Art Dot 100-color and 200-color sets.
 */
export const DMC_PALETTE: DmcColor[] = ${JSON.stringify(processed, null, 2)};
`;

fs.writeFileSync(outputPath, tsContent, 'utf-8');
console.log(`Successfully generated unified reference palette at ${outputPath}`);

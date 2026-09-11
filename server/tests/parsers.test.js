/**
 * Unit & Integration Tests for Vendor URL Parsers
 * Verifies non-scraping regex extractors for DigiKey, Mouser, McMaster-Carr, and domain fallbacks.
 */
import assert from 'assert';
import { parseVendorUrl } from '../services/parsers/vendorParser.js';

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

console.log('----------------------------------------------------');
console.log('🧪 RUNNING VENDOR URL PARSER TESTS');
console.log('----------------------------------------------------');

// 1. DigiKey Tests
test('DigiKey: Modern URL format with language prefix', () => {
  const url = 'https://www.digikey.com/en/products/detail/texas-instruments/TPS54302DDCR/6526789';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'DigiKey');
  assert.strictEqual(result.mpn, 'TPS54302DDCR');
  assert.strictEqual(result.sku, '6526789');
  assert.strictEqual(result.manufacturer, 'texas instruments');
  assert.strictEqual(result.recognized, true);
});

test('DigiKey: Regional .ca domain with numeric SKU', () => {
  const url = 'https://www.digikey.ca/en/products/detail/molex/0430450200/252490';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'DigiKey');
  assert.strictEqual(result.mpn, '0430450200');
  assert.strictEqual(result.sku, '252490');
  assert.strictEqual(result.manufacturer, 'molex');
  assert.strictEqual(result.recognized, true);
});

test('DigiKey: URL with complex query parameters and hash', () => {
  const url = 'https://www.digikey.com/en/products/detail/texas-instruments/TPS54302DDCR/6526789?s=N4IgTCBcDaIMwCYBsB2UBiAGALCA&utm_source=test#overview';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'DigiKey');
  assert.strictEqual(result.mpn, 'TPS54302DDCR');
  assert.strictEqual(result.sku, '6526789');
  assert.strictEqual(result.recognized, true);
});

test('DigiKey: Legacy /product-detail/ format', () => {
  const url = 'https://www.digikey.com/product-detail/en/panasonic-electronic-components/ERA-3AEB103V/P10KDBCT-ND/257321';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'DigiKey');
  assert.strictEqual(result.manufacturer, 'panasonic electronic components');
  assert.strictEqual(result.mpn, 'ERA-3AEB103V');
  assert.strictEqual(result.sku, 'P10KDBCT-ND');
  assert.strictEqual(result.recognized, true);
});

test('DigiKey: Modern URL without language prefix', () => {
  const url = 'https://www.digikey.com/products/detail/microchip-technology/ATMEGA328P-AU/183226';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'DigiKey');
  assert.strictEqual(result.manufacturer, 'microchip technology');
  assert.strictEqual(result.mpn, 'ATMEGA328P-AU');
  assert.strictEqual(result.sku, '183226');
  assert.strictEqual(result.recognized, true);
});

// 2. Mouser Tests
test('Mouser: Standard two-segment manufacturer and MPN', () => {
  const url = 'https://www.mouser.com/ProductDetail/Texas-Instruments/TPS54302DDCR?qs=y6Sm2912D3M%252B%2FEoV';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'Mouser');
  assert.strictEqual(result.manufacturer, 'Texas Instruments');
  assert.strictEqual(result.mpn, 'TPS54302DDCR');
  assert.strictEqual(result.sku, 'TPS54302DDCR');
  assert.strictEqual(result.recognized, true);
});

test('Mouser: Regional Canadian URL', () => {
  const url = 'https://www.mouser.ca/ProductDetail/Molex/43045-0200?qs=abcdef1234';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'Mouser');
  assert.strictEqual(result.manufacturer, 'Molex');
  assert.strictEqual(result.mpn, '43045-0200');
  assert.strictEqual(result.sku, '43045-0200');
  assert.strictEqual(result.recognized, true);
});

test('Mouser: Single-segment Mouser Part Number format', () => {
  const url = 'https://www.mouser.com/ProductDetail/595-TPS54302DDCR';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'Mouser');
  assert.strictEqual(result.mpn, '595-TPS54302DDCR');
  assert.strictEqual(result.sku, '595-TPS54302DDCR');
  assert.strictEqual(result.recognized, true);
});

// 3. McMaster-Carr Tests
test('McMaster-Carr: Standard catalog number at path end', () => {
  const url = 'https://www.mcmaster.com/91290A115/';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'McMaster-Carr');
  assert.strictEqual(result.manufacturer, 'McMaster-Carr');
  assert.strictEqual(result.mpn, '91290A115');
  assert.strictEqual(result.sku, '91290A115');
  assert.strictEqual(result.recognized, true);
});

test('McMaster-Carr: Deep link path with catalog item', () => {
  const url = 'https://www.mcmaster.com/screws/91290A115';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'McMaster-Carr');
  assert.strictEqual(result.mpn, '91290A115');
  assert.strictEqual(result.sku, '91290A115');
  assert.strictEqual(result.recognized, true);
});

test('McMaster-Carr: Metric catalog format (e.g. 12345K67)', () => {
  const url = 'https://www.mcmaster.com/12345K67';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'McMaster-Carr');
  assert.strictEqual(result.mpn, '12345K67');
  assert.strictEqual(result.sku, '12345K67');
  assert.strictEqual(result.recognized, true);
});

// 4. LCSC & JLCPCB Tests (Circuits imprimés & Composants EV)
test('LCSC: Standard product-detail URL with C-part number', () => {
  const url = 'https://www.lcsc.com/product-detail/Microcontroller-Units-MCUs-MPUs-SOCs_STMicroelectronics-STM32F407VGT6_C12345.html';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'LCSC');
  assert.strictEqual(result.mpn, 'C12345');
  assert.strictEqual(result.sku, 'C12345');
  assert.strictEqual(result.recognized, true);
});

test('JLCPCB: Component search link with C-part number', () => {
  const url = 'https://jlcpcb.com/parts/componentSearch?searchTxt=C2040';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'JLCPCB');
  assert.strictEqual(result.sku, 'C2040');
  assert.strictEqual(result.recognized, true);
});

// 5. Fallback Tests
test('Fallback: Recognized domain from Fastenal', () => {
  const url = 'https://www.fastenal.com/products/details/12345';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'Fastenal');
  assert.strictEqual(result.sku, '');
  assert.strictEqual(result.mpn, '');
  assert.strictEqual(result.recognized, false);
});

test('Fallback: Recognized domain without protocol prefix', () => {
  const url = 'misumi.com/vona2/detail/123';
  const result = parseVendorUrl(url);

  assert.strictEqual(result.supplier, 'Misumi');
  assert.strictEqual(result.recognized, false);
});

test('Fallback: Null, empty, and invalid inputs', () => {
  const r1 = parseVendorUrl('');
  assert.strictEqual(r1.supplier, 'Other');
  assert.strictEqual(r1.recognized, false);

  const r2 = parseVendorUrl(null);
  assert.strictEqual(r2.supplier, 'Other');
  assert.strictEqual(r2.recognized, false);

  const r3 = parseVendorUrl('   ');
  assert.strictEqual(r3.supplier, 'Other');
  assert.strictEqual(r3.recognized, false);
});

console.log(`\n🎉 All ${passed}/${total} Vendor Parser Tests Passed Successfully!\n`);

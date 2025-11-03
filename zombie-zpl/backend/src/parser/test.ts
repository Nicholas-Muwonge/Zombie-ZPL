import { ZplParser } from '../src/parser/parser';
import { ZplUtils } from '../src/parser/utils';

describe('ZPL Parser', () => {
  const parser = new ZplParser();

  test('should parse simple label with text', () => {
    const zpl = `^XA
^FO50,50
^ADN,36,20
^FDHello World^FS
^XZ`;

    const result = parser.parse(zpl);
    
    expect(result.metadata.errors).toHaveLength(0);
    expect(result.commands).toHaveLength(5);
    expect(result.commands[0].type).toBe('LABEL_START');
    expect(result.commands[3].type).toBe('FIELD_DATA');
  });

  test('should parse barcode command', () => {
    const zpl = `^XA
^FO100,100
^BCN,100,Y,N,N
^FD123456789^FS
^XZ`;

    const result = parser.parse(zpl);
    const barcodeCmd = result.commands.find(cmd => cmd.type === 'BARCODE');
    
    expect(barcodeCmd).toBeDefined();
    expect((barcodeCmd as any).height).toBe(100);
    expect((barcodeCmd as any).data).toBe('123456789');
  });

  test('should handle errors gracefully', () => {
    const zpl = `^XA
^FO50
^FDTest^FS
^XZ`;

    const result = parser.parse(zpl);
    
    expect(result.metadata.errors.length).toBeGreaterThan(0);
    expect(result.commands).toHaveLength(4); // Should still parse other commands
  });
});

describe('ZPL Utilities', () => {
  test('should convert dots to pixels correctly', () => {
    const pixels = ZplUtils.dotsToPixels(203); // 1 inch at 203 DPI
    expect(pixels).toBeCloseTo(96); // Should be ~96 pixels at screen DPI
  });

  test('should map ZPL fonts to CSS', () => {
    const font = ZplUtils.mapZplFontToCss('A');
    expect(font.fontFamily).toContain('Arial');
    expect(font.fontWeight).toBe('normal');
  });
});
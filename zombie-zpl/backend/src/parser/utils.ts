import { Coordinate } from '../../shared/ast-types';

export class ZplUtils {
  // Coordinate conversion
  static dotsToPixels(dots: number, dpi: number = 203): number {
    return (dots / dpi) * 96; // Convert to screen pixels at 96 DPI
  }

  static dotsToMillimeters(dots: number, dpi: number = 203): number {
    return (dots / dpi) * 25.4;
  }

  static pixelsToDots(pixels: number, dpi: number = 203): number {
    return (pixels / 96) * dpi;
  }

  static millimetersToDots(mm: number, dpi: number = 203): number {
    return (mm / 25.4) * dpi;
  }

  // Font mapping from ZPL codes to modern equivalents
  static mapZplFontToCss(zplFont: string): { fontFamily: string; fontWeight: string } {
    const fontMap: Record<string, { fontFamily: string; fontWeight: string }> = {
      '0': { fontFamily: 'Arial, sans-serif', fontWeight: 'normal' },
      'A': { fontFamily: 'Arial, sans-serif', fontWeight: 'normal' },
      'B': { fontFamily: 'Arial, sans-serif', fontWeight: 'bold' },
      'C': { fontFamily: 'Courier New, monospace', fontWeight: 'normal' },
      'D': { fontFamily: 'Courier New, monospace', fontWeight: 'bold' },
      'F': { fontFamily: 'Times New Roman, serif', fontWeight: 'normal' },
      'G': { fontFamily: 'Times New Roman, serif', fontWeight: 'bold' }
    };

    return fontMap[zplFont] || fontMap['0'];
  }

  // Barcode parameter interpretation
  static interpretBarcodeParams(params: Record<string, any>): {
    type: string;
    humanReadable: boolean;
    checkDigit: boolean;
  } {
    const command = params.command;
    let type = 'UNKNOWN';
    
    switch (command) {
      case 'BC': type = 'Code 128'; break;
      case 'B3': type = 'Code 39'; break;
      case 'BN': type = 'Interleaved 2 of 5'; break;
    }

    return {
      type,
      humanReadable: params.printInterpretationLine || false,
      checkDigit: params.mode === 'Y'
    };
  }

  // Calculate actual position considering label home
  static calculateAbsolutePosition(
    x: number, 
    y: number, 
    labelHome?: { x: number; y: number }
  ): Coordinate {
    const baseX = labelHome?.x || 0;
    const baseY = labelHome?.y || 0;

    return {
      x: baseX + x,
      y: baseY + y,
      unit: 'dots'
    };
  }

  // Validate ZPL command parameters
  static validateCommand(command: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (command.type) {
      case 'FIELD_ORIGIN':
        if (command.x < 0 || command.y < 0) {
          errors.push('FO coordinates cannot be negative');
        }
        if (command.x > 2000 || command.y > 6000) {
          errors.push('FO coordinates exceed reasonable label size');
        }
        break;
      
      case 'BARCODE':
        if (command.height < 1 || command.height > 1000) {
          errors.push('Barcode height out of reasonable range (1-1000)');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
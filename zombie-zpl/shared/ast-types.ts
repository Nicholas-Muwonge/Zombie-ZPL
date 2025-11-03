// Core coordinate and measurement types
export interface Coordinate {
  x: number;
  y: number;
  unit: 'dots' | 'mm' | 'pixels';
}

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface ParseError {
  message: string;
  position: SourcePosition;
  severity: 'ERROR' | 'WARNING';
  code: string;
}

export interface ParseWarning {
  message: string;
  position: SourcePosition;
  suggestion?: string;
}

// Base command interface
export interface ZplCommand {
  type: string;
  command: string;
  raw: string;
  position: SourcePosition;
  parameters: Record<string, string | number | boolean>;
}

// Label control commands
export interface LabelStartCommand extends ZplCommand {
  type: 'LABEL_START';
  command: 'XA';
}

export interface LabelEndCommand extends ZplCommand {
  type: 'LABEL_END';
  command: 'XZ';
}

export interface LabelLengthCommand extends ZplCommand {
  type: 'LABEL_LENGTH';
  command: 'LL';
  length: number;
}

export interface LabelHomeCommand extends ZplCommand {
  type: 'LABEL_HOME';
  command: 'LH';
  x: number;
  y: number;
}

// Field placement commands
export interface FieldOriginCommand extends ZplCommand {
  type: 'FIELD_ORIGIN';
  command: 'FO';
  x: number;
  y: number;
}

export interface FieldReverseCommand extends ZplCommand {
  type: 'FIELD_REVERSE';
  command: 'FR';
  x: number;
  y: number;
}

export interface GraphicBoxCommand extends ZplCommand {
  type: 'GRAPHIC_BOX';
  command: 'GB';
  width: number;
  height: number;
  thickness: number;
  color: 'B' | 'W';
  rounding?: number;
}

// Text rendering commands
export interface FieldDataCommand extends ZplCommand {
  type: 'FIELD_DATA';
  command: 'FD';
  content: string;
  stopCommand: boolean;
}

export interface FontSelectionCommand extends ZplCommand {
  type: 'FONT_SELECTION';
  command: 'A';
  font: string;
  orientation: 'N' | 'R' | 'I' | 'B';
  height: number;
  width?: number;
}

export interface ChangeFontCommand extends ZplCommand {
  type: 'CHANGE_FONT';
  command: 'CF';
  font: string;
  height?: number;
  width?: number;
}

// Barcode commands
export interface BarcodeCommand extends ZplCommand {
  type: 'BARCODE';
  command: 'BC' | 'B3' | 'BN';
  orientation: 'N' | 'R' | 'I' | 'B';
  height: number;
  printInterpretationLine: boolean;
  printAboveCode: boolean;
  mode?: string;
  data: string;
}

// Graphic commands
export interface GraphicFieldCommand extends ZplCommand {
  type: 'GRAPHIC_FIELD';
  command: 'GF';
  format: 'A' | 'B' | 'C';
  bytes: number;
  data?: string;
}

// Root document structure
export interface ZplDocument {
  type: 'ZPL_DOCUMENT';
  commands: ZplCommand[];
  metadata: {
    source: string;
    errors: ParseError[];
    warnings: ParseWarning[];
    labelWidth?: number;
    labelLength?: number;
  };
}

// Union type for all commands
export type AnyZplCommand = 
  | LabelStartCommand
  | LabelEndCommand
  | LabelLengthCommand
  | LabelHomeCommand
  | FieldOriginCommand
  | FieldReverseCommand
  | GraphicBoxCommand
  | FieldDataCommand
  | FontSelectionCommand
  | ChangeFontCommand
  | BarcodeCommand
  | GraphicFieldCommand;
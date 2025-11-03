import { 
  Token, 
  TokenType, 
  ZplTokenizer 
} from './tokenizer';
import { 
  ZplDocument, 
  AnyZplCommand, 
  ZplCommand,
  SourcePosition,
  ParseError,
  ParseWarning,
  LabelStartCommand,
  LabelEndCommand,
  LabelLengthCommand,
  LabelHomeCommand,
  FieldOriginCommand,
  FieldReverseCommand,
  GraphicBoxCommand,
  FieldDataCommand,
  FontSelectionCommand,
  ChangeFontCommand,
  BarcodeCommand,
  GraphicFieldCommand
} from '../../shared/ast-types';

export class ZplParser {
  private tokens: Token[] = [];
  private current: number = 0;
  private errors: ParseError[] = [];
  private warnings: ParseWarning[] = [];

  parse(source: string): ZplDocument {
    const tokenizer = new ZplTokenizer(source);
    const tokenizeResult = tokenizer.tokenize();
    
    this.tokens = tokenizeResult.tokens;
    this.errors = tokenizeResult.errors;
    this.current = 0;
    this.warnings = [];

    const commands: AnyZplCommand[] = [];
    
    while (!this.isAtEnd()) {
      try {
        const command = this.parseCommand();
        if (command) {
          commands.push(command);
        }
      } catch (error) {
        this.synchronize();
      }
    }

    const document: ZplDocument = {
      type: 'ZPL_DOCUMENT',
      commands,
      metadata: {
        source,
        errors: this.errors,
        warnings: this.warnings,
        labelWidth: this.calculateLabelWidth(commands),
        labelLength: this.calculateLabelLength(commands)
      }
    };

    return document;
  }

  private parseCommand(): AnyZplCommand | null {
    if (this.match(TokenType.COMMAND_START)) {
      const commandStart = this.previous();
      const commandToken = this.consume(TokenType.COMMAND_CODE, 'Expected command code after ^');
      
      switch (commandToken.value) {
        case 'XA':
          return this.parseLabelStart(commandStart, commandToken);
        case 'XZ':
          return this.parseLabelEnd(commandStart, commandToken);
        case 'LL':
          return this.parseLabelLength(commandStart, commandToken);
        case 'LH':
          return this.parseLabelHome(commandStart, commandToken);
        case 'FO':
          return this.parseFieldOrigin(commandStart, commandToken);
        case 'FR':
          return this.parseFieldReverse(commandStart, commandToken);
        case 'GB':
          return this.parseGraphicBox(commandStart, commandToken);
        case 'FD':
          return this.parseFieldData(commandStart, commandToken);
        case 'A':
          return this.parseFontSelection(commandStart, commandToken);
        case 'CF':
          return this.parseChangeFont(commandStart, commandToken);
        case 'BC':
        case 'B3':
        case 'BN':
          return this.parseBarcode(commandStart, commandToken);
        case 'GF':
          return this.parseGraphicField(commandStart, commandToken);
        default:
          this.addWarning(`Unsupported command: ${commandToken.value}`, commandToken.position);
          return this.parseGenericCommand(commandStart, commandToken);
      }
    }

    this.advance();
    return null;
  }

  private parseLabelStart(startToken: Token, commandToken: Token): LabelStartCommand {
    const raw = `^${commandToken.value}`;
    
    return {
      type: 'LABEL_START',
      command: 'XA',
      raw,
      position: startToken.position,
      parameters: this.parseParameters()
    };
  }

  private parseLabelEnd(startToken: Token, commandToken: Token): LabelEndCommand {
    const raw = `^${commandToken.value}`;
    
    return {
      type: 'LABEL_END',
      command: 'XZ',
      raw,
      position: startToken.position,
      parameters: {}
    };
  }

  private parseLabelLength(startToken: Token, commandToken: Token): LabelLengthCommand {
    const raw = `^${commandToken.value}`;
    const parameters = this.parseParameters();
    const length = this.parseNumberParameter(parameters[0] as string, 100);

    return {
      type: 'LABEL_LENGTH',
      command: 'LL',
      raw,
      position: startToken.position,
      length,
      parameters
    };
  }

  private parseLabelHome(startToken: Token, commandToken: Token): LabelHomeCommand {
    const raw = `^${commandToken.value}`;
    const parameters = this.parseParameters();
    
    if (parameters.length < 2) {
      this.addError('LH command requires x and y parameters', startToken.position);
    }

    const x = this.parseNumberParameter(parameters[0] as string, 0);
    const y = this.parseNumberParameter(parameters[1] as string, 0);

    return {
      type: 'LABEL_HOME',
      command: 'LH',
      raw,
      position: startToken.position,
      x,
      y,
      parameters
    };
  }

  private parseFieldOrigin(startToken: Token, commandToken: Token): FieldOriginCommand {
    const raw = `^${commandToken.value}`;
    const parameters = this.parseParameters();
    
    if (parameters.length < 2) {
      this.addError('FO command requires x and y parameters', startToken.position);
    }

    const x = this.parseNumberParameter(parameters[0] as string, 0);
    const y = this.parseNumberParameter(parameters[1] as string, 0);

    return {
      type: 'FIELD_ORIGIN',
      command: 'FO',
      raw,
      position: startToken.position,
      x,
      y,
      parameters
    };
  }

  private parseFieldData(startToken: Token, commandToken: Token): FieldDataCommand {
    const raw = `^${commandToken.value}`;
    let content = '';
    let stopCommand = false;

    // Look for string content until we find ^FS or end
    if (this.check(TokenType.PARAMETER)) {
      const contentToken = this.advance();
      content = contentToken.value;
    }

    // Check if the next command is FS (Field Stop)
    if (this.check(TokenType.COMMAND_START) && this.peekNext()?.type === TokenType.COMMAND_CODE) {
      const nextCommand = this.tokens[this.current + 1];
      if (nextCommand.value === 'FS') {
        stopCommand = true;
        this.advance(); // COMMAND_START
        this.advance(); // COMMAND_CODE
      }
    }

    return {
      type: 'FIELD_DATA',
      command: 'FD',
      raw,
      position: startToken.position,
      content,
      stopCommand,
      parameters: { content }
    };
  }

  private parseBarcode(startToken: Token, commandToken: Token): BarcodeCommand {
    const raw = `^${commandToken.value}`;
    const parameters = this.parseParameters();
    
    // BC command format: ^BCo,h,f,g,e,d
    const orientation = this.parseOrientation(parameters[0] as string);
    const height = this.parseNumberParameter(parameters[1] as string, 10);
    const printInterpretationLine = this.parseBooleanParameter(parameters[2] as string, true);
    const printAboveCode = this.parseBooleanParameter(parameters[3] as string, false);
    const mode = parameters[4] as string;
    
    // Look for FD content for the barcode data
    let data = '';
    if (this.check(TokenType.COMMAND_START) && this.peekNext()?.type === TokenType.COMMAND_CODE) {
      const nextCommand = this.tokens[this.current + 1];
      if (nextCommand.value === 'FD') {
        this.advance(); // COMMAND_START
        this.advance(); // COMMAND_CODE (FD)
        if (this.check(TokenType.PARAMETER)) {
          data = this.advance().value;
        }
      }
    }

    return {
      type: 'BARCODE',
      command: commandToken.value as 'BC' | 'B3' | 'BN',
      raw,
      position: startToken.position,
      orientation,
      height,
      printInterpretationLine,
      printAboveCode,
      mode,
      data,
      parameters
    };
  }

  private parseGraphicBox(startToken: Token, commandToken: Token): GraphicBoxCommand {
    const raw = `^${commandToken.value}`;
    const parameters = this.parseParameters();
    
    // GBw,h,t,c,r
    const width = this.parseNumberParameter(parameters[0] as string, 1);
    const height = this.parseNumberParameter(parameters[1] as string, 1);
    const thickness = this.parseNumberParameter(parameters[2] as string, 1);
    const color = (parameters[3] as string === 'W' ? 'W' : 'B') as 'B' | 'W';
    const rounding = parameters[4] ? this.parseNumberParameter(parameters[4] as string, 0) : undefined;

    return {
      type: 'GRAPHIC_BOX',
      command: 'GB',
      raw,
      position: startToken.position,
      width,
      height,
      thickness,
      color,
      rounding,
      parameters
    };
  }

  private parseFontSelection(startToken: Token, commandToken: Token): FontSelectionCommand {
    const raw = `^${commandToken.value}`;
    const parameters = this.parseParameters();
    
    // A@f,o,h,w
    const font = parameters[0] as string || '0';
    const orientation = this.parseOrientation(parameters[1] as string);
    const height = this.parseNumberParameter(parameters[2] as string, 10);
    const width = parameters[3] ? this.parseNumberParameter(parameters[3] as string, height) : undefined;

    return {
      type: 'FONT_SELECTION',
      command: 'A',
      raw,
      position: startToken.position,
      font,
      orientation,
      height,
      width,
      parameters
    };
  }

  private parseGenericCommand(startToken: Token, commandToken: Token): ZplCommand {
    const raw = `^${commandToken.value}`;
    const parameters = this.parseParameters();

    return {
      type: 'GENERIC_COMMAND',
      command: commandToken.value,
      raw,
      position: startToken.position,
      parameters
    };
  }

  // Utility parsing methods
  private parseParameters(): (string | number | boolean)[] {
    const parameters: (string | number | boolean)[] = [];
    
    while (this.check(TokenType.PARAMETER)) {
      const paramToken = this.advance();
      parameters.push(paramToken.value);
    }
    
    return parameters;
  }

  private parseNumberParameter(value: string, defaultValue: number): number {
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  private parseBooleanParameter(value: string, defaultValue: boolean): boolean {
    if (value === 'Y') return true;
    if (value === 'N') return false;
    return defaultValue;
  }

  private parseOrientation(value: string): 'N' | 'R' | 'I' | 'B' {
    if (['N', 'R', 'I', 'B'].includes(value)) {
      return value as 'N' | 'R' | 'I' | 'B';
    }
    return 'N';
  }

  // Parser utility methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token | null {
    if (this.current + 1 >= this.tokens.length) return null;
    return this.tokens[this.current + 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    
    throw this.addError(message, this.peek().position);
  }

  private synchronize(): void {
    this.advance();
    
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.NEWLINE) return;
      
      if (this.check(TokenType.COMMAND_START)) return;
      
      this.advance();
    }
  }

  private addError(message: string, position: SourcePosition): ParseError {
    const error: ParseError = {
      message,
      position,
      severity: 'ERROR',
      code: 'PARSER_ERROR'
    };
    this.errors.push(error);
    return error;
  }

  private addWarning(message: string, position: SourcePosition, suggestion?: string): void {
    this.warnings.push({
      message,
      position,
      suggestion
    });
  }

  private calculateLabelWidth(commands: AnyZplCommand[]): number | undefined {
    // Simple heuristic based on FO commands
    const fieldOrigins = commands.filter(cmd => cmd.type === 'FIELD_ORIGIN') as FieldOriginCommand[];
    if (fieldOrigins.length === 0) return undefined;
    
    return Math.max(...fieldOrigins.map(fo => fo.x)) + 100; // Add some padding
  }

  private calculateLabelLength(commands: AnyZplCommand[]): number | undefined {
    const lengthCmd = commands.find(cmd => cmd.type === 'LABEL_LENGTH') as LabelLengthCommand;
    return lengthCmd?.length;
  }

  // Stubs for other command parsers (implement similarly)
  private parseFieldReverse(startToken: Token, commandToken: Token): FieldReverseCommand {
    // Implementation similar to FieldOriginCommand
    return {} as FieldReverseCommand;
  }

  private parseChangeFont(startToken: Token, commandToken: Token): ChangeFontCommand {
    // Implementation similar to FontSelectionCommand  
    return {} as ChangeFontCommand;
  }

  private parseGraphicField(startToken: Token, commandToken: Token): GraphicFieldCommand {
    // Implementation for GF command
    return {} as GraphicFieldCommand;
  }
}
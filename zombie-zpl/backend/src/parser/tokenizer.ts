import { SourcePosition, ParseError } from '../../shared/ast-types';

export interface Token {
  type: TokenType;
  value: string;
  position: SourcePosition;
  raw: string;
}

export enum TokenType {
  COMMAND_START = 'COMMAND_START', // ^
  COMMAND_CODE = 'COMMAND_CODE',   // XA, FO, FD, etc.
  PARAMETER = 'PARAMETER',         // 50,100, N, Y, etc.
  STRING_CONTENT = 'STRING_CONTENT', // Text between FD and FS
  COMMENT = 'COMMENT',             // // or /* */
  NEWLINE = 'NEWLINE',
  EOF = 'EOF'
}

export class ZplTokenizer {
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private errors: ParseError[] = [];

  constructor(private source: string) {}

  tokenize(): { tokens: Token[]; errors: ParseError[] } {
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.errors = [];

    while (this.position < this.source.length) {
      const char = this.source[this.position];
      
      if (char === '^') {
        this.tokenizeCommand();
      } else if (char === '\n') {
        this.tokenizeNewline();
      } else if (char === '/' && this.peek() === '/') {
        this.tokenizeLineComment();
      } else if (char === '/' && this.peek() === '*') {
        this.tokenizeBlockComment();
      } else if (this.isWhitespace(char)) {
        this.advance();
      } else {
        // Unexpected character - try to recover by advancing
        this.addError(`Unexpected character: ${char}`);
        this.advance();
      }
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: 'EOF',
      position: this.getCurrentPosition(),
      raw: ''
    });

    return { tokens: this.tokens, errors: this.errors };
  }

  private tokenizeCommand(): void {
    const startPos = this.getCurrentPosition();
    this.advance(); // Consume ^

    // Check if this is a two-character command
    let commandCode = '';
    while (this.position < this.source.length) {
      const char = this.source[this.position];
      if (this.isCommandChar(char)) {
        commandCode += char;
        this.advance();
      } else {
        break;
      }
    }

    if (commandCode) {
      this.tokens.push({
        type: TokenType.COMMAND_START,
        value: '^',
        position: startPos,
        raw: '^'
      });

      this.tokens.push({
        type: TokenType.COMMAND_CODE,
        value: commandCode,
        position: { ...startPos, column: startPos.column + 1 },
        raw: commandCode
      });

      // Tokenize parameters
      this.tokenizeParameters();
    } else {
      this.addError('Empty command after ^');
    }
  }

  private tokenizeParameters(): void {
    while (this.position < this.source.length) {
      const char = this.source[this.position];
      
      if (char === '^' || char === '\n') {
        break;
      } else if (char === ',') {
        this.advance(); // Consume comma, it's a parameter separator
      } else if (!this.isWhitespace(char)) {
        const paramStart = this.getCurrentPosition();
        let parameter = '';
        
        while (this.position < this.source.length) {
          const paramChar = this.source[this.position];
          if (paramChar === ',' || paramChar === '^' || paramChar === '\n' || this.isWhitespace(paramChar)) {
            break;
          }
          parameter += paramChar;
          this.advance();
        }

        if (parameter) {
          this.tokens.push({
            type: TokenType.PARAMETER,
            value: parameter,
            position: paramStart,
            raw: parameter
          });
        }
      } else {
        this.advance(); // Skip whitespace
      }
    }
  }

  private tokenizeStringContent(): string {
    let content = '';
    const startPos = this.getCurrentPosition();

    while (this.position < this.source.length) {
      const char = this.source[this.position];
      
      if (char === '^' && this.peek(3) === 'FS') {
        break; // Found field stop
      } else if (char === '\n') {
        // ZPL allows multiline FD content
        content += char;
        this.advance();
      } else {
        content += char;
        this.advance();
      }
    }

    if (content) {
      this.tokens.push({
        type: TokenType.STRING_CONTENT,
        value: content,
        position: startPos,
        raw: content
      });
    }

    return content;
  }

  private tokenizeNewline(): void {
    this.tokens.push({
      type: TokenType.NEWLINE,
      value: '\n',
      position: this.getCurrentPosition(),
      raw: '\n'
    });
    this.line++;
    this.column = 1;
    this.position++;
  }

  private tokenizeLineComment(): void {
    const startPos = this.getCurrentPosition();
    let comment = '//';
    this.advance(2); // Consume //

    while (this.position < this.source.length && this.source[this.position] !== '\n') {
      comment += this.source[this.position];
      this.advance();
    }

    this.tokens.push({
      type: TokenType.COMMENT,
      value: comment,
      position: startPos,
      raw: comment
    });
  }

  private tokenizeBlockComment(): void {
    const startPos = this.getCurrentPosition();
    let comment = '/*';
    this.advance(2); // Consume /*

    while (this.position < this.source.length - 1) {
      if (this.source[this.position] === '*' && this.source[this.position + 1] === '/') {
        comment += '*/';
        this.advance(2);
        break;
      }
      comment += this.source[this.position];
      this.advance();
    }

    this.tokens.push({
      type: TokenType.COMMENT,
      value: comment,
      position: startPos,
      raw: comment
    });
  }

  private isCommandChar(char: string): boolean {
    return /[A-Z0-9@]/.test(char);
  }

  private isWhitespace(char: string): boolean {
    return /[\s\t\r]/.test(char);
  }

  private peek(offset: number = 1): string {
    return this.source.substring(this.position, this.position + offset);
  }

  private advance(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      this.position++;
      this.column++;
    }
  }

  private getCurrentPosition(): SourcePosition {
    return {
      line: this.line,
      column: this.column,
      offset: this.position
    };
  }

  private addError(message: string): void {
    this.errors.push({
      message,
      position: this.getCurrentPosition(),
      severity: 'ERROR',
      code: 'TOKENIZER_ERROR'
    });
  }
}
import { ZplParser } from '../src/parser/parser';
import { ZplUtils } from '../src/parser/utils';

// Example ZPL code
const zplCode = `^XA
^LH0,0
^FO50,50^ADN,36,20^FDHello Zombie ZPL!^FS
^FO50,150^BCN,100,Y,N,N^FDSPOOKY123^FS
^FO50,300^GB400,100,10,B,0^FS
^XZ`;

// Parse the ZPL
const parser = new ZplParser();
const document = parser.parse(zplCode);

console.log('Parsing Results:');
console.log(`Commands: ${document.commands.length}`);
console.log(`Errors: ${document.metadata.errors.length}`);
console.log(`Warnings: ${document.metadata.warnings.length}`);

// Convert coordinates for web display
document.commands.forEach(command => {
  if (command.type === 'FIELD_ORIGIN') {
    const pixelsX = ZplUtils.dotsToPixels(command.x);
    const pixelsY = ZplUtils.dotsToPixels(command.y);
    console.log(`Field at: ${command.x},${command.y} dots -> ${pixelsX.toFixed(1)},${pixelsY.toFixed(1)} pixels`);
  }
});

// Output as JSON for modern applications
console.log('\nModern JSON Representation:');
console.log(JSON.stringify(document, null, 2));
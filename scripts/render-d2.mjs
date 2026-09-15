import {D2} from '@terrastruct/d2';
import fs from 'node:fs/promises';
const [input,output,layout]=process.argv.slice(2);
try {const engine=new D2();const compiled=await engine.compile(await fs.readFile(input,'utf8'),{layout});await fs.writeFile(output,await engine.render(compiled.diagram,compiled.renderOptions));process.exit(0);}catch(e){console.error(e);process.exit(1);}

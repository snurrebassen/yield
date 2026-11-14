import {writeFileSync} from 'node:fs';
writeFileSync(new URL('../dist-core/package.json',import.meta.url),JSON.stringify({name:'yield-simulation',version:'0.1.0',type:'module',main:'./index.js',types:'./index.d.ts',exports:{'.':{types:'./index.d.ts',import:'./index.js'}}},null,2)+'\n');

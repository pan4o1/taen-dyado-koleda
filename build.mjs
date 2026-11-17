import {build} from 'esbuild';
import {mkdirSync,copyFileSync,readFileSync} from 'node:fs';
mkdirSync('dist/.openai',{recursive:true});
await build({entryPoints:['worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.html':'text','.css':'text','.csv':'text','.svg':'text'},minify:true,plugins:[{name:'client-source',setup(build){build.onLoad({filter:/static\/app\.js$/},args=>({contents:readFileSync(args.path,'utf8'),loader:'text'}))}}]});
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');

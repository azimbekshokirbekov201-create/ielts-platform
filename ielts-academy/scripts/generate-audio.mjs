import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(join(root,'src/data/content.ts'),'utf8');
const script=source.match(/export const listeningScript\s*=\s*`([^`]+)`/s)?.[1];
if(!script)throw new Error('Original listening script was not found.');
const file=join(tmpdir(),`ielts-listening-${process.pid}.txt`);
try{writeFileSync(file,script);const result=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i',`flite=textfile=${file}:voice=slt`,'-ar','22050','-ac','1',join(root,'public/audio/riverside.wav')],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exitCode=result.status??1;}finally{unlinkSync(file)}

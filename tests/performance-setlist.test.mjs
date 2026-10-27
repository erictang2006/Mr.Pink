import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
const bundle=await build({entryPoints:['src/piano/performanceSetlist.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {performanceSetlist,nextPerformanceSong,nextPerformanceStep}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('live set advances Levels to Interstellar to Roses and the Soda Pop finale without wrapping',()=>{
 const visited=['levels'];
 while(nextPerformanceSong(visited.at(-1)))visited.push(nextPerformanceSong(visited.at(-1)));
 assert.deepEqual(visited,['levels','interstellar','roses','soda-pop']);
 assert.deepEqual(performanceSetlist,visited);
 assert.equal(nextPerformanceSong('rush-e'),undefined);
 assert.equal(nextPerformanceSong(''),undefined);
});

test('on-stage navigation preserves the stage and delegates to existing reset and preparation paths',()=>{
 const app=readFileSync('src/App.tsx','utf8');
 assert.match(app,/event.code === "ArrowRight" && !event.shiftKey/);
 assert.match(app,/if \(!event.repeat\) \{\s*const next = nextPerformanceStep\(songRef.current, performanceSectionRef.current\)/);
 assert.match(app,/selectSong\(next.song, true\)/);
 assert.match(app,/"section" in next\) changeInterstellarSection\(1\)/);
 const select=app.slice(app.indexOf('function selectSong('),app.indexOf('function selectRosesInstrument('));
 assert.match(select,/panic\(!stayOnStage\)/);
 assert.match(select,/performanceSectionRef.current = 1/);
 assert.match(select,/if \(!stayOnStage\) setView\("sandbox"\)/);
 assert.match(select,/void startAudio\(\)/);
 assert.match(select,/performanceMeasureRef.current = 1/);
 assert.doesNotMatch(select,/startAt\(/,'Roses retains its existing count-in start control');
 for(const file of ['src/App.tsx','src/components/LevelsPractice.tsx','src/components/PracticeStudio.tsx','src/components/RosesPractice.tsx','src/components/SandboxMode.tsx'])assert.doesNotMatch(readFileSync(file,'utf8'),/<option value="rush-e">/);
});


test('right arrow visits every Interstellar section before opening Roses',()=>{
 let song='levels',section=1;
 const visited=[song];
 for(let i=0;i<5;i++){
  const next=nextPerformanceStep(song,section);
  if(!next)break;
  if('section' in next)section=next.section;
  else {song=next.song;section=1;}
  visited.push(song==='interstellar'?`${song}:${section}`:song);
 }
 assert.deepEqual(visited,['levels','interstellar:1','interstellar:2','interstellar:3','roses','soda-pop']);
 assert.deepEqual(nextPerformanceStep('roses',1),{song:'soda-pop'});
 assert.equal(nextPerformanceStep('soda-pop',1),undefined);
});

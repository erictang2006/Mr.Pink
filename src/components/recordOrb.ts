import { helmetCrop, hwmVinylPalette, type HwmVisualFrame } from '../piano/rosesHwmVisuals';
import {drawBlackHole,drawAlbumReveal} from './rosesBlackHole';
import {revealEase,rosesRevealSettings} from '../piano/rosesReveal';
import { stageOrbGeometry, type StageEnergy } from './stageEnergy';

const tau=Math.PI*2;
const petals=Array.from({length:18},(_,i)=>({angle:i*2.399963,orbit:1.31+(i%6)*.065,size:4.5+(i%4)*1.7,speed:.000014+(i%5)*.000004}));
const spectrumSpokes=Array.from({length:144},(_,i)=>{
  const angle=i/144*tau-Math.PI/2,cos=Math.cos(angle);
  return {cos,sin:Math.sin(angle),group:i%6===0?3:i%3===0?0:cos<0?1:2};
});
const spectrumGroups=Array.from({length:32},()=>[] as number[]);
const spectrumColors=['#edb6ff','#59edff','#ff73d6','#edb6ff'];
type GrooveGroup={path:Path2D;tone:number;bold:boolean};
let groovePaths:GrooveGroup[]|undefined;
/** Eight shared paths retain all forty original grooves, colors, alphas and line widths. */
export function recordGroovePaths(){
  if(typeof Path2D==='undefined')return undefined;
  if(groovePaths)return groovePaths;
  const groups:GrooveGroup[]=[];
  for(let tone=0;tone<4;tone++)for(const bold of [false,true]){
    const path=new Path2D();
    for(let i=0;i<40;i++)if(i%4===tone&&(i%5===0)===bold){const radius=.657+i*.00825;path.moveTo(radius,0);path.arc(0,0,radius,0,tau);}
    groups.push({path,tone,bold});
  }
  groovePaths=groups;return groups;
}
export type RecordFrame={economical?:boolean;hwm?:HwmVisualFrame;hwmArtwork?:CanvasImageSource|null;particleClock?:number;concealed?:boolean;revealMs?:number;introBuild?:number;geometry?:{x:number;y:number;radius:number};artwork?:CanvasImageSource|null;rotation?:number;waveform?:Float32Array};

/** Visual-only, fixed-budget vinyl artwork. The cover never receives a rotation. */
export function drawRecordOrb(ctx:CanvasRenderingContext2D,width:number,height:number,now:number,energy:StageEnergy,reduced:boolean,frame:RecordFrame={}){
  const inheritedAlpha=ctx.globalAlpha;
  const {x,y,radius:baseRadius}=frame.geometry??stageOrbGeometry(width,height,now,energy,reduced);
  const hwm=frame.hwm,mix=hwm?.mix??0,palette=hwmVinylPalette(mix);
  const dropPulse=reduced?0:hwm?.bassPulse??0;
  const particlePhase=hwm?hwm.buildup*hwm.buildup*.8+Math.max(0,Math.min(32,hwm.beat-144))*.16:0;
  const r=baseRadius*(1+dropPulse*.012);
  if(r<1)return;
  const rotation=reduced?0:frame.rotation??0,clock=reduced?0:frame.particleClock??now;
  const concealed=!!frame.concealed,build=frame.introBuild??0;
  const level=energy.level,hit=energy.pulse*(1+Math.max(0,-energy.bias)*.3);
  ctx.save();
  // Local contrast stays behind the vinyl and never masks the live keyboard or camera.
  if(mix>0){
    const shade=ctx.createRadialGradient(x,y,r*.75,x,y,r*2.4);
    shade.addColorStop(0,`rgba(0,3,12,${mix*(hwm?.drop ? .72 : .4)})`);shade.addColorStop(1,'#01030b00');
    ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
  }
  const auraRadius=Math.min(r*1.85,width*.48,height*.47);
  const aura=ctx.createRadialGradient(x,y,r*.58,x,y,auraRadius);
  aura.addColorStop(0,concealed?`rgba(75,100,230,${.16+level*.18+build*.08})`:`rgba(${Math.round(225-191*mix)},${Math.round(54+65*mix)},${Math.round(185+70*mix)},${.25+level*.22+dropPulse*.1})`);aura.addColorStop(.5,`rgba(62,175,246,${.18+level*.2+energy.build*.06})`);aura.addColorStop(1,'#14204700');
  ctx.fillStyle=aura;ctx.fillRect(x-auraRadius,y-auraRadius,auraRadius*2,auraRadius*2);
  // Local cyan and pink haze joins the record to the stage without tinting the cover.
  for(const side of [-1,1]){
    const haloRadius=Math.min(r*.8,width*.23,height*.32),hx=x+side*r*.65,hy=y+r*.15;
    const halo=ctx.createRadialGradient(hx,hy,r*.05,hx,hy,haloRadius);
    halo.addColorStop(0,side<0?`rgba(45,211,255,${.17+level*.12})`:`rgba(${Math.round(247-108*mix)},${Math.round(64+46*mix)},${Math.round(194+61*mix)},${.18+level*.14})`);halo.addColorStop(1,'#00000000');
    ctx.fillStyle=halo;ctx.fillRect(hx-haloRadius,hy-haloRadius,haloRadius*2,haloRadius*2);
  }
  const rim=ctx.createLinearGradient(x-r,y-r,x+r,y+r);
  rim.addColorStop(0,palette.cyan);rim.addColorStop(.38,palette.violet);rim.addColorStop(.72,concealed&&build<.5?'#a497f6':palette.pink);rim.addColorStop(1,concealed&&build<.5?'#b5baff':palette.pale);

  // Note ripples and the single transport-derived drop entrance reach beyond the record.
  if(!reduced)for(const ring of energy.rings){
    const t=ring.ageMs/1350;
    ctx.globalAlpha=inheritedAlpha*((1-t)**2*ring.strength);ctx.strokeStyle=rim;ctx.lineWidth=1.5+ring.strength*3;
    ctx.beginPath();ctx.arc(x,y,r*(1.03+t*(energy.shock>.15?1.16:.79)),0,tau);ctx.stroke();
  }
  ctx.globalAlpha=inheritedAlpha;
  const vinyl=ctx.createRadialGradient(x-r*.25,y-r*.35,r*.05,x,y,r);
  vinyl.addColorStop(0,'#33253e');vinyl.addColorStop(.62,'#101222');vinyl.addColorStop(.81,'#0a1020');vinyl.addColorStop(.96,'#1a172e');vinyl.addColorStop(1,'#080d1b');
  ctx.fillStyle=vinyl;ctx.strokeStyle=rim;ctx.lineWidth=1.7+level;
  ctx.shadowColor=mix>.5?'#83dfff':energy.shock>.2?'#ff83d5':'#78dfff';ctx.shadowBlur=frame.economical?0:23+level*19+energy.shock*24+mix*8+dropPulse*12;
  ctx.beginPath();ctx.arc(x,y,r,0,tau);ctx.fill();ctx.stroke();ctx.shadowBlur=0;

  // Rotate groove highlights independently; the pink cover and typography stay upright.
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
  const grooves=recordGroovePaths();
  if(grooves){
    ctx.save();ctx.scale(r,r);
    for(const group of grooves){
      ctx.globalAlpha=inheritedAlpha*(.2+group.tone*.034+level*.09);ctx.strokeStyle=group.tone%2?(mix>0?palette.pink:'#ed86cb'):'#80cfee';ctx.lineWidth=(group.bold?1.15:.55)/r;ctx.stroke(group.path);
    }
    ctx.restore();
  }else{
  for(let i=0;i<40;i++){
    const radius=r*(.657+i*.00825);
    ctx.globalAlpha=inheritedAlpha*(.2+(i%4)*.034+level*.09);ctx.strokeStyle=i%2?(mix>0?palette.pink:'#ed86cb'):'#80cfee';ctx.lineWidth=i%5===0?1.15:.55;
    ctx.beginPath();ctx.arc(0,0,radius,0,tau);ctx.stroke();
  }
  }
  ctx.globalAlpha=inheritedAlpha*(.38+level*.18+energy.build*.15);ctx.strokeStyle='#c1e7ff';ctx.lineWidth=1.3;
  for(let i=0;i<5;i++){
    ctx.beginPath();ctx.arc(0,0,r*(.68+i*.061),-.94+i*.11,-.43+i*.11);ctx.stroke();
    ctx.strokeStyle=mix>0?palette.pale:'#f5a1d1';ctx.beginPath();ctx.arc(0,0,r*(.7+i*.055),2.06+i*.1,2.55+i*.1);ctx.stroke();
  }
  ctx.restore();

  // The same record geometry/grooves remain mounted while its center stays secret.
  ctx.save();ctx.beginPath();ctx.arc(x,y,r*.64,0,tau);ctx.clip();
  ctx.fillStyle='#030817';ctx.fillRect(x-r,y-r,r*2,r*2);
  const age=frame.revealMs;
  if(concealed||age!==undefined&&age<rosesRevealSettings.albumReveal){
    const collapse=age===undefined?1:Math.max(.025,1-revealEase(age/240));
    drawBlackHole(ctx,x,y,r*.64*collapse,now,level+hit*.15,build,reduced);
  }
  if(!concealed){
    const reveal=age===undefined?1:revealEase((age-140)/(rosesRevealSettings.albumReveal-140));
    ctx.save();ctx.beginPath();ctx.arc(x,y,r*.64*reveal,0,tau);ctx.clip();
    const artMix=frame.hwmArtwork?(hwm?.artworkMix??0):0;
    if(frame.artwork){
      ctx.globalAlpha=inheritedAlpha;
      ctx.drawImage(frame.artwork,x-r*.64,y-r*.64,r*1.28,r*1.28);
    }else if(artMix<1){
      ctx.globalAlpha=inheritedAlpha;ctx.fillStyle='#f5c4e1';ctx.font=`500 ${r*.12}px Inter, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('ROSES',x,y);
    }
    if(frame.hwmArtwork&&artMix>0){
      const image=frame.hwmArtwork as HTMLImageElement;
      const crop=helmetCrop(image.naturalWidth||image.width,image.naturalHeight||image.height);
      ctx.globalAlpha=inheritedAlpha*artMix;
      // Square source and destination preserve helmet proportions; no color filter or rotation.
      ctx.drawImage(frame.hwmArtwork,crop.x,crop.y,crop.size,crop.size,x-r*.64,y-r*.64,r*1.28,r*1.28);
    }
    ctx.restore();
  }
  // A narrow edge shade embeds the bright original in the dark record without tinting its title.
  const edge=ctx.createRadialGradient(x,y,r*.54,x,y,r*.65);
  edge.addColorStop(0,'#0b0b1800');edge.addColorStop(.6,'#15132912');edge.addColorStop(1,'#121425c0');ctx.fillStyle=edge;ctx.fillRect(x-r,y-r,r*2,r*2);
  ctx.restore();ctx.strokeStyle=mix>0?palette.pale:'#f0a9d0b0';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(x,y,r*.645,0,tau);ctx.stroke();
  ctx.globalAlpha=inheritedAlpha*(.3+level*.28);ctx.strokeStyle='#75efff';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(x,y,r*.655,-1.2,1.35);ctx.stroke();ctx.globalAlpha=inheritedAlpha;

  // Actual master waveform samples drive a luminous, fixed-budget spectrum.
  const samples=frame.waveform;
  const count=spectrumSpokes.length;
  for(const group of spectrumGroups)group.length=0;
  for(let i=0;i<count;i++){
    const spoke=spectrumSpokes[i],index=samples?.length?Math.floor(i/count*samples.length):0;
    const sample=samples?.length?Math.max(Math.abs(samples[index]),Math.abs(samples[(index+1)%samples.length])):0;
    const wave=Math.min(1,sample*5);
    const inner=r*1.035,length=r*(.026+wave*(.31+energy.build*.08+energy.drop*.07)+hit*.045+energy.thump*.085+energy.shock*.13);
    const alpha=Math.min(1,.44+wave*.5+level*.2+energy.flash*.18);
    // Preserve all 144 endpoints; batch equal color/width and nearby opacity into one path.
    const bucket=Math.round(alpha*7),points=spectrumGroups[spoke.group*8+bucket];
    points.push(x+spoke.cos*inner,y+spoke.sin*inner,x+spoke.cos*(inner+length),y+spoke.sin*(inner+length));
  }
  for(let group=0;group<spectrumGroups.length;group++){
    const points=spectrumGroups[group];if(!points.length)continue;
    const style=Math.floor(group/8),alpha=(group%8)/7,bold=style===3;
    ctx.strokeStyle=mix>0?palette.spectra[style]:spectrumColors[style];ctx.beginPath();
    for(let i=0;i<points.length;i+=4){ctx.moveTo(points[i],points[i+1]);ctx.lineTo(points[i+2],points[i+3]);}
    ctx.globalAlpha=inheritedAlpha*(alpha*.18);ctx.lineWidth=bold?6:4;ctx.stroke();
    ctx.globalAlpha=inheritedAlpha*alpha;ctx.lineWidth=bold?2.4:1.5;ctx.stroke();
  }
  ctx.globalAlpha=inheritedAlpha*(.6+level*.35);ctx.strokeStyle=rim;ctx.lineWidth=1.9+energy.flash*1.2;
  ctx.shadowColor=mix>.5?'#e4faff':energy.flash>.1?'#ffcef0':'#74dfff';ctx.shadowBlur=frame.economical?0:8+energy.flash*22+energy.shock*16;
  ctx.beginPath();ctx.arc(x,y,r*1.085,rotation*.65,rotation*.65+tau*.78);ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,r*1.15,-rotation*.48+1.3,-rotation*.48+3.7);ctx.stroke();
  ctx.shadowBlur=0;
  ctx.globalAlpha=inheritedAlpha;

  // Three short orbit trails remain bounded and react to the existing hit envelope.
  ctx.save();ctx.translate(x,y);ctx.rotate(reduced?0:-.18);ctx.scale(1,.42);
  for(let i=0;i<3;i++){
    const a=rotation*(i%2?-1:1)+i*2.1;
    ctx.strokeStyle=i%2?(mix>0?palette.pink:'#ff80db'):'#7deeff';ctx.globalAlpha=inheritedAlpha*(.18+level*.17+hit*.13);ctx.lineWidth=1+i*.4;
    ctx.beginPath();ctx.arc(0,0,r*(1.4+i*.1),a,a+.6+level*.3);ctx.stroke();
  }
  ctx.restore();

  if(!reduced&&!concealed)for(const petal of petals){
    const a=petal.angle+clock*petal.speed+particlePhase,orbit=r*(petal.orbit+energy.shock*.13-energy.build*.05);
    const px=x+Math.cos(a)*orbit,py=y+Math.sin(a)*orbit*.87;
    const size=petal.size*(1+level*.25);
    ctx.save();ctx.translate(px,py);ctx.rotate(a+Math.sin(clock*.0004+petal.angle)*.5);ctx.scale(.55+Math.abs(Math.cos(a*2))*.45,1);
    ctx.globalAlpha=inheritedAlpha*(.43+level*.32)*(1-mix);ctx.fillStyle=petal.size>7?'#ffb0dc':'#e775b6';
    ctx.beginPath();ctx.moveTo(0,-size);ctx.bezierCurveTo(size*1.4,-size*.6,size*.9,size*.8,0,size);ctx.bezierCurveTo(-size*.7,size*.4,-size,-size*.7,0,-size);ctx.fill();
    ctx.strokeStyle='#ffb5d466';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(0,-size*.7);ctx.quadraticCurveTo(size*.3,0,0,size*.7);ctx.stroke();ctx.restore();
    if(mix>0){
      const travel=1+(hwm?.buildup??0)*.08+dropPulse*.08;
      const bx=x+(px-x)*travel,by=y+(py-y)*travel;
      ctx.globalAlpha=inheritedAlpha*mix*(.5+dropPulse*.35);ctx.fillStyle=petal.size>7?palette.spark:palette.petal;
      ctx.beginPath();ctx.arc(bx,by,Math.min(2.6,size*.28),0,tau);ctx.fill();
      if(hwm?.drop){ctx.strokeStyle=palette.cyan;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx-(bx-x)*(.04+dropPulse*.05),by-(by-y)*(.04+dropPulse*.05));ctx.stroke();}
    }
  }
  // Sparse light motes share the petal orbit; the fixed count never grows with hits.
  for(let i=0;i<12;i++){
    const a=i*2.399963+(reduced?0:clock*.000012+particlePhase*1.5),orbit=r*(1.18+(i%4)*.105);
    const px=x+Math.cos(a)*orbit,py=y+Math.sin(a)*orbit*.94;
    ctx.globalAlpha=inheritedAlpha*(.3+level*.35);ctx.fillStyle=i%2?(mix>0?palette.spark:'#ffc5ed'):'#a3f5ff';
    ctx.fillRect(px-1,py-1,2,2);
    if(i%3===0){ctx.globalAlpha=inheritedAlpha*(.16+hit*.2);ctx.fillRect(px-4,py-.4,8,.8);ctx.fillRect(px-.4,py-4,.8,8);}
  }
  if(hwm&&!concealed){
    // These waves and the entrance flash are functions of score position, not mounted-at timers.
    for(const wave of [hwm.labelWave,hwm.dropWave])if(wave>=0&&!reduced){
      ctx.globalAlpha=inheritedAlpha*Math.sin(Math.PI*wave)*.65;ctx.strokeStyle=palette.spark;ctx.lineWidth=2.4;
      ctx.beginPath();ctx.arc(x,y,r*(1+wave*.75),0,tau);ctx.stroke();
    }
    if(hwm.drop){
      ctx.globalAlpha=inheritedAlpha*(.12+dropPulse*.48);ctx.strokeStyle=palette.spark;ctx.lineWidth=1.5+dropPulse*2;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x,y,r*(1.03+i*.055+dropPulse*.025),0,tau);ctx.stroke();}
      // An annular light burst keeps the white helmet crisp and the flash restrained.
      if(hwm.dropFlash>0&&!reduced){
        const burst=ctx.createRadialGradient(x,y,r*.68,x,y,r*1.55);
        burst.addColorStop(0,'#ffffff00');burst.addColorStop(.35,`rgba(225,248,255,${hwm.dropFlash*.2})`);burst.addColorStop(1,'#60cfff00');
        ctx.globalAlpha=inheritedAlpha;ctx.fillStyle=burst;ctx.fillRect(x-r*1.55,y-r*1.55,r*3.1,r*3.1);
      }
    }
  }
  ctx.globalAlpha=inheritedAlpha;
  if(age!==undefined)drawAlbumReveal(ctx,x,y,r,age,reduced);
  ctx.restore();
}

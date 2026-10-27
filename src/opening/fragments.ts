/** Cut planes follow the original artwork's arcs, lettering bands and central stem.
 * Every region clips the supplied alpha mask; none substitutes drawn logo geometry. */
export type Point = readonly [number,number];
export type FragmentRole = 'upper'|'ring'|'center'|'lower';
export type LogoFragment = {id:string;role:FragmentRole;polygon:readonly Point[];origin:Point;delay:number;turn:number;depth:number};
const piece=(id:string,role:FragmentRole,polygon:readonly Point[],origin:Point,delay:number,turn:number,depth:number):LogoFragment=>({id,role,polygon,origin,delay,turn,depth});
export const logoFragments:readonly LogoFragment[] = [
  piece('upper-left-arc','ring',[[0,0],[50,0],[50,12],[28,12],[9,26],[0,26]],[27,13],0,-.19,.08),
  piece('upper-right-arc','ring',[[50,0],[100,0],[100,26],[91,26],[72,12],[50,12]],[73,13],55,.22,-.07),
  piece('upper-left-inlay','upper',[[50,12],[50,28],[0,28],[0,26],[9,26],[28,12]],[35,23],75,-.12,.04),
  piece('upper-right-inlay','upper',[[50,12],[72,12],[91,26],[100,26],[100,28],[50,28]],[65,23],110,.15,-.06),
  piece('middle-left','center',[[0,28],[50,28],[50,45],[0,45]],[39,37],35,-.1,.07),
  piece('middle-right','center',[[50,28],[100,28],[100,45],[50,45]],[61,37],65,.13,-.08),
  piece('letter-c','center',[[0,45],[31,45],[31,62],[0,62]],[22,53],100,-.11,.04),
  piece('letter-s','center',[[31,45],[68,45],[68,62],[31,62]],[50,54],0,.07,.12),
  piece('letter-a','center',[[68,45],[100,45],[100,62],[68,62]],[79,53],145,.16,-.03),
  piece('lower-left-arc','ring',[[0,62],[47,62],[47,69],[14,69],[28,86],[47,92],[47,100],[0,100]],[22,78],35,-.23,.08),
  piece('lower-left-inlay','lower',[[14,69],[47,69],[47,92],[28,86]],[37,79],155,-.14,.05),
  piece('lower-stem','lower',[[47,62],[53,62],[53,100],[47,100]],[50,81],105,.06,.12),
  piece('lower-right-inlay','lower',[[53,69],[86,69],[72,86],[53,92]],[64,79],190,.16,-.04),
  piece('lower-right-arc','ring',[[53,62],[100,62],[100,100],[53,100],[53,92],[72,86],[86,69],[53,69]],[78,78],90,.26,-.08),
];

export function pointInFragment(polygon:readonly Point[],x:number,y:number):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
/** Sample true alpha contours once, including the lettering cutouts. No invented shard origins. */
export function sourceEdgeAnchors(rgba:ArrayLike<number>,width:number,height:number):Point[][] {
  const buckets:Point[][]=logoFragments.map(()=>[]);
  const step=3;
  const alpha=(x:number,y:number)=>x<0||y<0||x>=width||y>=height?0:rgba[(y*width+x)*4+3];
  for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step) {
    if(alpha(x,y)<128||Math.min(alpha(x-step,y),alpha(x+step,y),alpha(x,y-step),alpha(x,y+step))>=64)continue;
    const point:Point=[x/width*100,y/height*100];
    const index=logoFragments.findIndex(fragment=>pointInFragment(fragment.polygon,point[0],point[1]));
    if(index>=0)buckets[index].push(point);
  }
  return buckets.map((points,index)=>points.length?Array.from({length:Math.min(96,points.length)},(_,i)=>points[Math.floor(i*points.length/Math.min(96,points.length))]):[logoFragments[index].origin]);
}

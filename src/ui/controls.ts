export function steeringInput(keys:ReadonlySet<string>):number {
  return Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft'));
}

export function freshSeed():number{return Math.floor(Math.random()*0x100000000)>>>0;}

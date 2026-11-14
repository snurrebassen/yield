// Browser-only adapter. The simulation emits horn pulses without owning audio APIs.
export class HornAudio {
  enabled=true;
  private context:AudioContext|null=null;
  private volume:GainNode|null=null;
  unlock(){
    if(!this.enabled||typeof AudioContext==='undefined')return;
    try{if(!this.context){this.context=new AudioContext();this.volume=this.context.createGain();this.volume.gain.value=.45;this.volume.connect(this.context.destination);}if(this.context.state==='suspended')void this.context.resume().catch(()=>{});}catch{}
  }
  setEnabled(enabled:boolean){this.enabled=enabled;if(this.volume&&this.context)this.volume.gain.setValueAtTime(enabled?.45:0,this.context.currentTime);if(enabled)this.unlock();}
  play(actorId:number){
    const context=this.context;if(!this.enabled||!context||context.state!=='running'||!this.volume)return;
    const now=context.currentTime,duration=actorId===-1?.24:.17,envelope=context.createGain();
    envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(.045,now+.015);envelope.gain.setValueAtTime(.035,now+duration-.04);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);envelope.connect(this.volume);
    const base=actorId===-1?405:365+(actorId%4)*22;
    for(const ratio of [1,1.24]){const tone=context.createOscillator();tone.type='triangle';tone.frequency.setValueAtTime(base*ratio,now);tone.connect(envelope);tone.start(now);tone.stop(now+duration+.02);tone.onended=()=>tone.disconnect();}
    setTimeout(()=>envelope.disconnect(),(duration+.08)*1000);
  }
}

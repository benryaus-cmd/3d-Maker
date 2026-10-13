import type {VisualWeapon} from './WeaponVisuals';

/** Original synthesised local reports; no remote assets, licensing or fetches. */
export class CombatAudio {
 private context:AudioContext|null=null;
 private master:GainNode|null=null;
 private noise:AudioBuffer|null=null;
 private voices=new Set<AudioScheduledSourceNode>();
 private nodes=new Set<AudioNode>();
 private muted=false;
 private volume=.55;
 private disposed=false;
 /** Call synchronously inside the first pointer/key gesture. */
 unlock():void{
  if(this.disposed||typeof window==='undefined')return;
  if(!this.context){const AudioCtor=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!AudioCtor)return;
   this.context=new AudioCtor();this.master=this.context.createGain();this.master.gain.value=this.muted?0:this.volume;this.master.connect(this.context.destination);
   this.noise=this.context.createBuffer(1,this.context.sampleRate*.6,this.context.sampleRate);const data=this.noise.getChannelData(0);let seed=78291;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=seed/2147483648;}
  }
  if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
 }
 setMuted(muted:boolean):void{this.muted=muted;this.syncVolume();}
 setVolume(volume:number):void{this.volume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.55;this.syncVolume();}
 private syncVolume(){if(this.master&&this.context)this.master.gain.setTargetAtTime(this.muted?0:this.volume,this.context.currentTime,.015);}
 private ready(){return !this.disposed&&!this.muted&&this.context?.state==='running'&&this.master&&this.voices.size<24;}
 private envelope(time:number,duration:number,amplitude:number){const gain=this.context!.createGain();gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,amplitude),time+.003);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);gain.connect(this.master!);this.nodes.add(gain);return gain;}
 private track(source:AudioScheduledSourceNode,owned:AudioNode[]){this.voices.add(source);owned.forEach(n=>this.nodes.add(n));source.onended=()=>{source.disconnect();this.voices.delete(source);owned.forEach(n=>{n.disconnect();this.nodes.delete(n);});};}
 private report(time:number,duration:number,frequency:number,amplitude:number,highpass:number){if(this.voices.size>22)return;const ctx=this.context!,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=this.envelope(time,duration,amplitude);source.buffer=this.noise;filter.type='highpass';filter.frequency.value=highpass;source.connect(filter);filter.connect(gain);this.track(source,[filter,gain]);source.start(time);source.stop(time+duration);
  const bass=ctx.createOscillator(),body=this.envelope(time,duration*.8,amplitude*.48);bass.type='triangle';bass.frequency.setValueAtTime(frequency,time);bass.frequency.exponentialRampToValueAtTime(38,time+duration*.8);bass.connect(body);this.track(bass,[body]);bass.start(time);bass.stop(time+duration);
 }
 shot(weapon:VisualWeapon,volume=1):void{if(!this.ready())return;const v=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):1,time=this.context!.currentTime;
  const settings=weapon==='shotgun'?{duration:.32,frequency:155,amp:.8,cut:170}:weapon==='smg'?{duration:.095,frequency:220,amp:.38,cut:850}:{duration:.18,frequency:195,amp:.53,cut:420};this.report(time,settings.duration,settings.frequency,settings.amp*v,settings.cut);
 }
 reload(weapon:VisualWeapon):void{if(!this.ready())return;const now=this.context!.currentTime;
  // Mechanical eject/seat clicks, with pump tail for the shotgun.
  for(const [delay,freq] of [[0,1100],[weapon==='shotgun'?.3:.22,650],[weapon==='shotgun'?.65:.52,1700]])this.report(now+delay,.045,freq,.15,1800);
 }
 dispose():void{if(this.disposed)return;this.disposed=true;for(const voice of this.voices){voice.onended=null;try{voice.stop();}catch{}voice.disconnect();}this.voices.clear();this.nodes.forEach(n=>n.disconnect());this.nodes.clear();this.master?.disconnect();if(this.context)void this.context.close().catch(()=>{});this.context=null;this.master=null;this.noise=null;}
}

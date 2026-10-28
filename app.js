(() => {
'use strict';
const $ = id => document.getElementById(id);
let audioCtx=null, master=null, drumBus=null, synthBus=null, reverbNode=null, dryGain=null, wetGain=null;
let playing=false, timer=null, step=0, nextTime=0, startTime=0, clockTimer=null, metronome=false, mediaRecorder=null, chunks=[], recordingStart=0, recordTimer=null, takeUrl=null;
const rows=[{name:'KICK',key:'kick',steps:[0,8]},{name:'SNARE',key:'snare',steps:[4,12]},{name:'CLOSED HAT',key:'hat',steps:[0,2,4,6,8,10,12,14]},{name:'OPEN HAT',key:'open',steps:[]}];
let pattern=rows.map(r=>Array.from({length:16},(_,i)=>r.steps.includes(i)));
function initAudio(){
 if(audioCtx)return;
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC){toast('Web Audio is not supported in this browser.');return}
 audioCtx=new AC();
 master=audioCtx.createGain(); master.gain.value=+$('masterVol').value/100;
 drumBus=audioCtx.createGain(); drumBus.gain.value=+$('drumVol').value/100;
 synthBus=audioCtx.createGain(); synthBus.gain.value=+$('synthVol').value/100;
 const comp=audioCtx.createDynamicsCompressor(); comp.threshold.value=-8; comp.knee.value=15; comp.ratio.value=4; comp.attack.value=.004; comp.release.value=.18;
 drumBus.connect(comp); synthBus.connect(comp); comp.connect(master); master.connect(audioCtx.destination);
 dryGain=audioCtx.createGain(); wetGain=audioCtx.createGain(); wetGain.gain.value=0;
 reverbNode=audioCtx.createConvolver(); const len=audioCtx.sampleRate*1.8, buf=audioCtx.createBuffer(2,len,audioCtx.sampleRate);
 for(let c=0;c<2;c++){let d=buf.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}
 reverbNode.buffer=buf; synthBus.connect(dryGain); dryGain.connect(comp); synthBus.connect(reverbNode); reverbNode.connect(wetGain); wetGain.connect(comp);
 if(audioCtx.state==='suspended')audioCtx.resume();
}
function tone(freq,dur,type='sine',vol=.5,when=null,bus=drumBus){
 if(!audioCtx)return; const t=when??audioCtx.currentTime, o=audioCtx.createOscillator(), g=audioCtx.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(Math.max(.0001,vol),t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+.03);
}
function noise(dur,vol,filterFreq,when,bus=drumBus){
 const n=Math.floor(audioCtx.sampleRate*dur), b=audioCtx.createBuffer(1,n,audioCtx.sampleRate), d=b.getChannelData(0);
 for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
 const src=audioCtx.createBufferSource(), f=audioCtx.createBiquadFilter(), g=audioCtx.createGain();
 src.buffer=b;f.type='highpass';f.frequency.value=filterFreq;g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(.0001,when+dur);src.connect(f);f.connect(g);g.connect(bus);src.start(when);src.stop(when+dur);
}
function drum(type,t){
 const kit=$('kit').value;
 if(type==='kick'){tone(kit==='industrial'?65:145,.22,'sine',.95,t);tone(kit==='industrial'?42:58,.18,'sine',.6,t+.015)}
 if(type==='snare'){noise(.19,kit==='acoustic'?.5:.35,700,t);tone(190,.12,'triangle',.25,t)}
 if(type==='hat')noise(.045,kit==='industrial'?.24:.13,7000,t);
 if(type==='open')noise(.22,.18,6500,t);
}
function synthNote(midi,duration=.22,when=null){
 initAudio();if(!audioCtx)return; if(audioCtx.state==='suspended')audioCtx.resume();
 const t=when??audioCtx.currentTime, osc=audioCtx.createOscillator(), filt=audioCtx.createBiquadFilter(), gain=audioCtx.createGain();
 osc.type=$('wave').value;osc.frequency.value=440*Math.pow(2,(midi-69)/12);filt.type='lowpass';filt.frequency.value=+$('filter').value;filt.Q.value=.8;
 gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.24,t+.012);gain.gain.setTargetAtTime(.0001,t+duration,.07);
 osc.connect(filt);filt.connect(gain);gain.connect(synthBus);osc.start(t);osc.stop(t+duration+.35);
}
function renderSeq(){
 const root=$('sequencer');root.innerHTML='';
 const nums=document.createElement('div');nums.className='seq-numbers';nums.append(document.createElement('span'));
 for(let i=0;i<16;i++){const s=document.createElement('span');s.textContent=i%4===0?String(i/4+1):'·';nums.append(s)}root.append(nums);
 rows.forEach((r,ri)=>{const row=document.createElement('div');row.className='seq-row';const label=document.createElement('div');label.className='seq-label';label.textContent=r.name;row.append(label);
 for(let i=0;i<16;i++){const b=document.createElement('button');b.className='step'+(i%4===0?' beat':'')+(pattern[ri][i]?' on':'');b.setAttribute('aria-label',r.name+' step '+(i+1));b.addEventListener('click',()=>{pattern[ri][i]=!pattern[ri][i];b.classList.toggle('on',pattern[ri][i]);initAudio();if(pattern[ri][i])drum(r.key,audioCtx.currentTime)});row.append(b)}root.append(row)});
}
function tick(){
 if(!playing)return; const bpm=Math.max(50,Math.min(200,+$('tempo').value||110)), interval=60/bpm/4;
 while(nextTime<audioCtx.currentTime+.12){
  const swing=+$('swing').value/100, t=nextTime+(step%2?interval*swing:0);
  pattern.forEach((p,ri)=>{if(p[step])drum(rows[ri].key,t)});
  if(metronome&&step%4===0)tone(step===0?1300:900,.035,'square',.12,t);
  step=(step+1)%16;nextTime+=interval;
 }
 $('sequencer').querySelectorAll('.step').forEach((el,i)=>el.classList.toggle('playing',i%16===step));
 timer=setTimeout(tick,25);
}
function play(){
 initAudio();if(!audioCtx)return;
 if(playing){playing=false;clearTimeout(timer);clearInterval(clockTimer);$('playBtn').textContent='▶';$('sessionState').textContent='READY';$('sequencer').querySelectorAll('.step').forEach(x=>x.classList.remove('playing'));return}
 if(audioCtx.state==='suspended')audioCtx.resume();playing=true;step=0;nextTime=audioCtx.currentTime+.06;startTime=performance.now();$('playBtn').textContent='Ⅱ';$('sessionState').textContent='PLAYING';
 clockTimer=setInterval(()=>$('clock').textContent=fmt((performance.now()-startTime)/1000),100);tick();
}
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0')+'.'+Math.floor((s%1)*10)}
function buildKeys(){
 const root=$('keys');root.innerHTML='';const notes=[['C',0,false],['C♯',1,true],['D',2,false],['D♯',3,true],['E',4,false],['F',5,false],['F♯',6,true],['G',7,false],['G♯',8,true],['A',9,false],['A♯',10,true],['B',11,false],['C',12,false]];
 notes.forEach(([name,n,black])=>{const b=document.createElement('button');b.className='key'+(black?' black':'');b.textContent=name;b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('active');synthNote(12*(+$('octave').value+1)+n,.3)});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>b.classList.remove('active')));root.append(b)});
}
function toast(msg){$('toast').textContent=msg;setTimeout(()=>$('toast').textContent='',3500)}
function saveSession(){
 const data={version:2,arrTracks,tempo:+$('tempo').value,kit:$('kit').value,swing:+$('swing').value,wave:$('wave').value,octave:$('octave').value,filter:+$('filter').value,pattern,volumes:{drum:$('drumVol').value,synth:$('synthVol').value,master:$('masterVol').value},reverb:$('reverb').checked,wet:$('wet').value};
 try{localStorage.setItem('nocturne-session',JSON.stringify(data));toast('Session saved on this device.')}catch(e){toast('Could not save session in this browser.')}
}
function loadSession(){
 try{const d=JSON.parse(localStorage.getItem('nocturne-session'));if(!d)return;
 $('tempo').value=d.tempo||110;$('kit').value=d.kit||'electro';$('swing').value=d.swing||0;$('wave').value=d.wave||'sawtooth';$('octave').value=d.octave||3;$('filter').value=d.filter||2800;
 if(d.pattern?.length===4)pattern=d.pattern;
 ['drum','synth','master'].forEach(k=>{if(d.volumes?.[k])$(k+'Vol').value=d.volumes[k]});
 $('reverb').checked=!!d.reverb;$('wet').value=d.wet||18;updateVolumes();
 }catch(e){}
}
function updateVolumes(){
 ['drum','synth','master'].forEach(k=>{$(k+'VolVal').textContent=$(k+'Vol').value+'%';if(audioCtx){const node=k==='drum'?drumBus:k==='synth'?synthBus:master;if(node)node.gain.setTargetAtTime(+$ (k+'Vol').value/100,audioCtx.currentTime,.02)}});
 if(wetGain)wetGain.gain.value=$('reverb').checked?(+$('wet').value/100):0;
}
function randomize(){
 pattern=rows.map((r,ri)=>Array.from({length:16},(_,i)=>ri===0?(i===0||i===8||Math.random()<.12):ri===1?(i===4||i===12||Math.random()<.08):ri===2?Math.random()<.62:Math.random()<.08));
 renderSeq();toast('New drum pattern generated.');
}
async function startRecording(){
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  chunks=[];mediaRecorder=new MediaRecorder(stream);mediaRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  mediaRecorder.onstop=()=>{const blob=new Blob(chunks,{type:mediaRecorder.mimeType||'audio/webm'});if(takeUrl)URL.revokeObjectURL(takeUrl);takeUrl=URL.createObjectURL(blob);$('takeAudio').src=takeUrl;$('downloadTake').disabled=false;$('downloadTake').onclick=()=>{const a=document.createElement('a');a.href=takeUrl;a.download='nocturne-take.'+(blob.type.includes('mp4')?'mp4':'webm');a.click()};stream.getTracks().forEach(t=>t.stop());$('recordStatus').textContent='TAKE READY';$('recordDot').classList.remove('recording');$('lanes').innerHTML='<div class="lane"><b>MIC TAKE</b><div class="lane-track"><div class="lane-clip green" style="width:100%"></div></div></div><div class="lane"><b>DRUM LOOP</b><div class="lane-track"><div class="lane-clip" style="width:64%"></div></div></div>';};
  mediaRecorder.start(200);recordingStart=performance.now();$('recordBtn').disabled=true;$('stopRecordBtn').disabled=false;$('recordStatus').textContent='RECORDING';$('recordDot').classList.add('recording');
  recordTimer=setInterval(()=>$('recordTime').textContent=fmt((performance.now()-recordingStart)/1000),100);
 }catch(e){toast('Microphone unavailable. Use HTTPS and allow microphone access.');$('recordStatus').textContent='MIC PERMISSION NEEDED'}
}
function stopRecording(){if(mediaRecorder&&mediaRecorder.state!=='inactive')mediaRecorder.stop();clearInterval(recordTimer);$('recordBtn').disabled=false;$('stopRecordBtn').disabled=true;$('recordTime').textContent=fmt((performance.now()-recordingStart)/1000)}
function exportWav(){
 initAudio();if(!audioCtx)return;
 const bpm=Math.max(50,Math.min(200,+$('tempo').value||110)), duration=4*60/bpm, rate=44100, frames=Math.ceil(duration*rate), offline=new OfflineAudioContext(2,frames,rate);
 const masterO=offline.createGain();masterO.gain.value=+$('masterVol').value/100;const drumO=offline.createGain();drumO.gain.value=+$('drumVol').value/100;drumO.connect(masterO);masterO.connect(offline.destination);
 function osc(f,d,type,v,t){let o=offline.createOscillator(),g=offline.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(drumO);o.start(t);o.stop(t+d)}
 function nz(dur,v,hz,t){let n=Math.floor(rate*dur),b=offline.createBuffer(1,n,rate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=Math.random()*2-1;let s=offline.createBufferSource(),f=offline.createBiquadFilter(),g=offline.createGain();s.buffer=b;f.type='highpass';f.frequency.value=hz;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(drumO);s.start(t)}
 for(let i=0;i<16;i++){const t=i*60/bpm/4;pattern.forEach((p,ri)=>{if(!p[i])return;if(ri===0){osc(145,.22,'sine',.95,t);osc(58,.18,'sine',.6,t+.015)}if(ri===1){nz(.19,.35,700,t);osc(190,.12,'triangle',.25,t)}if(ri===2)nz(.045,.13,7000,t);if(ri===3)nz(.22,.18,6500,t)})}
 // Render the synth track too, for an actual mixed loop export.
 const synthO=offline.createGain();synthO.gain.value=+$('synthVol').value/100;synthO.connect(masterO);
 // four-bar simple low synth pulse; pattern and notes remain editable in the live instrument.
 for(let i=0;i<16;i++){let o=offline.createOscillator(),g=offline.createGain(),f=offline.createBiquadFilter();o.type=$('wave').value;o.frequency.value=110*Math.pow(2,(i%7)/12);f.type='lowpass';f.frequency.value=+$('filter').value;g.gain.setValueAtTime(.0001,i*60/bpm/4);g.gain.linearRampToValueAtTime(.07,i*60/bpm/4+.01);g.gain.exponentialRampToValueAtTime(.0001,i*60/bpm/4+.22);o.connect(f);f.connect(g);g.connect(synthO);o.start(i*60/bpm/4);o.stop(i*60/bpm/4+.25)}
 offline.startRendering().then(buf=>{const wav=toWav(buf),url=URL.createObjectURL(wav),a=document.createElement('a');a.href=url;a.download='nocturne-loop.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('WAV loop exported.');}).catch(()=>toast('Export failed. Try again.'));
}
function toWav(buffer){
 const channels=buffer.numberOfChannels, rate=buffer.sampleRate, frames=buffer.length, out=new ArrayBuffer(44+frames*channels*2),v=new DataView(out);
 const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};str(0,'RIFF');v.setUint32(4,36+frames*channels*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*channels*2,true);
 const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));let p=44;for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){let x=Math.max(-1,Math.min(1,data[c][i]));v.setInt16(p,x<0?x*32768:x*32767,true);p+=2}return new Blob([out],{type:'audio/wav'});
}

let arrTracks = [
 {name:"DRUMS",type:"PATTERN",color:"",clips:[{start:0,len:4,label:"DRUM LOOP"},{start:4,len:4,label:"DRUM LOOP"}]},
 {name:"BASS",type:"INSTRUMENT",color:"red",clips:[{start:0,len:4,label:"BASS IDEA"}]},
 {name:"SYNTH",type:"INSTRUMENT",color:"blue",clips:[{start:2,len:3,label:"PAD"},{start:5,len:3,label:"PAD"}]},
 {name:"VOCALS",type:"AUDIO",color:"purple",clips:[{start:4,len:2,label:"VOCAL TAKE"}]}
];
function renderArrangement(){
 const ruler=$('ruler'); if(!ruler)return; ruler.innerHTML='';
 for(let i=1;i<=8;i++){const s=document.createElement('span');s.textContent=i;ruler.append(s)}
 const root=$('trackList');root.innerHTML='';
 arrTracks.forEach((tr,ti)=>{
  const row=document.createElement('div');row.className='track-row';
  const meta=document.createElement('div');meta.className='track-meta';
  const b=document.createElement('b');b.textContent=tr.name;
  const small=document.createElement('small');small.textContent=tr.type;
  const del=document.createElement('button');del.textContent='REMOVE';del.addEventListener('click',()=>{if(arrTracks.length>1){arrTracks.splice(ti,1);renderArrangement()}else toast('Keep at least one track.')});
  meta.append(b,small,del);
  const lane=document.createElement('div');lane.className='track-lane';
  tr.clips.forEach((clip,ci)=>{const el=document.createElement('button');el.className='arr-clip '+tr.color;el.textContent=clip.label;el.style.left=(clip.start/8*100)+'%';el.style.width=(clip.len/8*100-.8)+'%';el.addEventListener('click',()=>{if(confirm('Remove "'+clip.label+'" clip?')){tr.clips.splice(ci,1);renderArrangement()}});lane.append(el)});
  lane.addEventListener('dblclick',ev=>{const r=lane.getBoundingClientRect();const start=Math.max(0,Math.min(7,Math.floor((ev.clientX-r.left)/r.width*8)));tr.clips.push({start,len:1,label:tr.name+' CLIP'});renderArrangement()});
  row.append(meta,lane);root.append(row);
 });
 $('trackCount').textContent=arrTracks.length;
 $('clipCount').textContent=arrTracks.reduce((n,t)=>n+t.clips.length,0);
}
$('addTrack')?.addEventListener('click',()=>{const name=prompt('Name this track','NEW TRACK');if(!name)return;arrTracks.push({name:name.toUpperCase().slice(0,16),type:'INSTRUMENT',color:['green','purple','blue','red'][arrTracks.length%4],clips:[]});renderArrangement()});
$('addClip')?.addEventListener('click',()=>{if(!arrTracks.length)return;const tr=arrTracks[0];const end=tr.clips.reduce((m,c)=>Math.max(m,c.start+c.len),0);tr.clips.push({start:Math.min(7,Math.floor(end)),len:1,label:'NEW CLIP'});renderArrangement();});

renderArrangement();
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab))}));
$('playBtn').addEventListener('click',play);$('clearBtn').addEventListener('click',()=>{if(confirm('Clear all drum steps?')){pattern=rows.map(()=>Array(16).fill(false));renderSeq()}});
$('randomBtn').addEventListener('click',randomize);$('metronomeBtn').addEventListener('click',()=>{metronome=!metronome;$('metronomeBtn').textContent='METRONOME '+(metronome?'ON':'OFF')});
$('saveBtn').addEventListener('click',saveSession);$('saveBtn2').addEventListener('click',saveSession);$('exportBtn').addEventListener('click',exportWav);$('exportBtn2').addEventListener('click',exportWav);
$('recordBtn').addEventListener('click',startRecording);$('stopRecordBtn').addEventListener('click',stopRecording);
['drumVol','synthVol','masterVol'].forEach(id=>$(id).addEventListener('input',updateVolumes));$('reverb').addEventListener('change',()=>{initAudio();updateVolumes()});$('wet').addEventListener('input',updateVolumes);
$('kit').addEventListener('change',()=>toast('Kit changed.'));$('tempo').addEventListener('change',()=>{$('tempo').value=Math.max(50,Math.min(200,+$('tempo').value||110))});
loadSession();try{const saved=JSON.parse(localStorage.getItem('nocturne-session'));if(saved?.arrTracks)arrTracks=saved.arrTracks}catch(e){}renderSeq();buildKeys();renderArrangement();updateVolumes();
})();
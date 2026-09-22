import {afterEach,expect,it,vi} from 'vitest';
import {BrowserAudioBackend,createDefaultAudioBackend,isAutomationMuteEnabled} from './audioBackend';

afterEach(()=>vi.unstubAllGlobals());
it('media error listeners are delivered and removed with the owned audio element', async ()=>{
  let element!: EventTarget & {play:()=>Promise<void>;pause:()=>void;removeAttribute:()=>void;load:()=>void};
  class Media extends EventTarget {
    loop=false; preload=''; volume=1;
    constructor(public src:string){super();element=this;}
    async play(){} pause(){} removeAttribute(){} load(){}
  }
  vi.stubGlobal('Audio',Media);
  const backend=new BrowserAudioBackend();
  const handle=backend.createPlayback({id:'custom',src:'blob:local',channel:'sfx',loop:false,source:'self-generated'});
  const failed=vi.fn();handle.onError?.(failed);
  await handle.play(); element.dispatchEvent(new Event('error'));
  expect(failed).toHaveBeenCalledOnce();
  handle.dispose();element.dispatchEvent(new Event('error'));
  expect(failed).toHaveBeenCalledOnce();backend.dispose();
});

it('only mute=1 enables automation silence',()=>{
  expect(isAutomationMuteEnabled('?mute=1')).toBe(true);
  expect(isAutomationMuteEnabled('?table3d=1&mute=1')).toBe(true);
  expect(isAutomationMuteEnabled('')).toBe(false);
  expect(isAutomationMuteEnabled('?mute=0')).toBe(false);
  expect(isAutomationMuteEnabled('?mute=10')).toBe(false);
});

it.each([['?mute=1',true],['',false]])('keeps playback and asset loading active for %s',async(search,muted)=>{
  const created: Media[]=[];
  class Media extends EventTarget {
    loop=false; preload=''; volume=1; muted=false; playCount=0; loadCount=0;
    constructor(public src:string){super();created.push(this);}
    async play(){this.playCount+=1;} pause(){} removeAttribute(){} load(){this.loadCount+=1;}
  }
  vi.stubGlobal('Audio',Media);
  vi.stubGlobal('window',{location:{search}});
  const backend=createDefaultAudioBackend();
  const handles=[
    backend.createPlayback({id:'bgm',src:'/bgm.wav',channel:'bgm',loop:true,source:'project-local'}),
    backend.createPlayback({id:'sfx',src:'/sfx.wav',channel:'sfx',loop:false,source:'project-local'}),
    backend.createPlayback({id:'voice',src:'/voice.wav',channel:'voice',loop:false,source:'project-local'}),
  ];
  handles.forEach(handle=>handle.setVolume(0.7));
  await Promise.all(handles.map(handle=>handle.play()));
  expect(created.map(audio=>audio.src)).toEqual(['/bgm.wav','/sfx.wav','/voice.wav']);
  expect(created.every(audio=>audio.muted===muted && audio.volume===0.7 && audio.preload==='auto' && audio.playCount===1)).toBe(true);
  backend.dispose();
  expect(created.every(audio=>audio.loadCount===1)).toBe(true);
});

import {SynthAudio} from '../audio/synth.js';
import {cardKey,isRed,SolitaireSession,TABLEAU_COUNT,type Card,type MoveRequest,type PileState} from '../model/solitaire.ts';
import {decodeSave,encodeSave,sessionFromSave} from '../model/save.ts';

interface FileContext{
 owner:string;
 valid():boolean;
 path(value:string):string;
 name(value:string):string;
 files:{
  read(path:string):Promise<{data:Uint8Array;version:string;status?:string}>;
  write(path:string,data:Uint8Array|string,version:string|null):Promise<{version:string;status?:string}>;
  stat?(path:string):Promise<{version:string;status?:string;bytes?:number}>;
  sync():Promise<unknown>;
  subscribe?(fn:()=>void):()=>void;
 };
}
interface Host{
 signal:AbortSignal;
 w?:{
  launchContext?:{version:1;storage:'mirror';path:string;owner:string};
  title?:string;
  ownerSub?:string;
  solitaire?:{dirty:boolean};
 };
 ui:{
  make(tag:string,className?:string,text?:string):HTMLElement;
  textButton(label:string,action:()=>void):HTMLButtonElement;
  appInput(label:string,value?:string):HTMLInputElement;
  confirm?(message:string,options?:{title?:string;confirmLabel?:string;cancelLabel?:string;danger?:boolean;signal?:AbortSignal}):Promise<boolean>;
 };
 storage:{
  signedInSubject():string;
  mirrorFileContext():Promise<FileContext>;
  pickFile(options:{extensions:string[];signal?:AbortSignal}):Promise<string|null>;
  pickFolder(options:{signal?:AbortSignal}):Promise<string|null>;
 };
}

type Selection={from:'waste'|'foundation';index:number}|{from:'tableau';index:number;cardIndex:number};

export interface LayoutMetrics {
 w: number;
 h: number;
 dpr: number;
 tier: 'phone' | 'desktop' | '4k';
 margin: number;
 colWidth: number;
 cardW: number;
 cardH: number;
 topY: number;
 tableauY: number;
 stockX: number;
 wasteX: number;
 foundationX: number;
 foundationStep: number;
 rankFont: string;
 suitFont: string;
 footerFont: string;
 cardRadius: number;
 statusY: number;
}

export function computeLayout(containerW: number, containerH: number, dpr: number): LayoutMetrics {
 const w = Math.max(320, containerW || 636);
 const h = Math.max(460, containerH || 620);
 const tier = w < 768 ? 'phone' : (w >= 2560 || (w >= 1920 && dpr >= 2)) ? '4k' : 'desktop';

 const margin = tier === 'phone' ? Math.max(6, Math.floor(w * 0.015)) : tier === '4k' ? Math.max(20, Math.floor(w * 0.03)) : Math.max(12, Math.floor(w * 0.02));
 const availableColWidth = (w - 2 * margin) / TABLEAU_COUNT;
 const gap = Math.max(3, Math.floor(availableColWidth * 0.10));
 const cardW = Math.max(38, Math.floor(availableColWidth - gap));
 const cardH = Math.floor(cardW * 1.38);
 const colWidth = availableColWidth;

 const topY = margin;
 const stockX = margin;
 const wasteX = margin + colWidth;
 const foundationX = margin + 3 * colWidth;
 const foundationStep = colWidth;

 const tableauY = topY + cardH + Math.max(10, Math.floor(h * 0.025));
 const rankFontSize = Math.max(10, Math.floor(cardW * 0.22));
 const suitFontSize = Math.max(14, Math.floor(cardW * 0.32));
 const footerFontSize = Math.max(11, Math.min(18, Math.floor(w * 0.018)));
 const statusY = h - Math.max(10, Math.floor(footerFontSize * 0.9));
 const cardRadius = Math.max(3, Math.floor(cardW * 0.07));

 return {
  w, h, dpr, tier, margin, colWidth, cardW, cardH, topY, tableauY, stockX, wasteX, foundationX, foundationStep,
  rankFont: `bold ${rankFontSize}px system-ui`,
  suitFont: `${suitFontSize}px system-ui`,
  footerFont: `${footerFontSize}px system-ui`,
  cardRadius, statusY
 };
}

export async function startView(host:Host,signal:AbortSignal):Promise<{element:HTMLElement;dispose():void}>{
 const {make,textButton,appInput}=host.ui,doc=document;
 const owner=host.w?.launchContext?.owner||host.storage.signedInSubject();
 const state=host.w?.solitaire??{dirty:false};
 if(host.w){host.w.solitaire=state;host.w.ownerSub=owner;}
 let session=new SolitaireSession(`deal-${Date.now()}`,3);
 session.pause();
 let selected:Selection|null=null,busy=false,disposed=false,revision=0,savedPath:string|null=null,savedVersion:string|null=null,unwatch=()=>{},watchSerial=0,frame=0,last=performance.now(),lastSummary='',hint:MoveRequest|null=null;
 const audio=new SynthAudio(),element=make('section','solitaire-view'),header=make('header','solitaire-header'),heading=make('h2','solitaire-heading','Solitaire Table'),hostCard=make('aside','solitaire-rive-pending','Table host · dynamic resolution responsive tier active'),toolbar=make('div','solitaire-toolbar'),board=make('canvas','solitaire-board') as HTMLCanvasElement,controls=make('div','solitaire-controls'),settings=doc.createElement('details'),help=doc.createElement('details'),saveDetails=doc.createElement('details'),warning=make('div','solitaire-warning'),status=make('div','app-status');
 board.tabIndex=0;board.setAttribute('role','application');board.setAttribute('aria-label','Klondike card table. Use Tab to controls, arrow keys to move selection, Enter to select or move, Space to draw, Escape to pause.');
 warning.hidden=true;warning.setAttribute('role','status');status.setAttribute('role','status');header.append(heading,hostCard);
 const start=textButton('Start game',()=>{session.resume();selected=null;audio.setMuted(!sound.checked);if(sound.checked)audio.unlock();audio.resume();last=performance.now();mark();announce('Game started.');refresh();});
 const pause=textButton('Pause',()=>{if(session.paused){session.resume();audio.resume();announce('Game resumed.')}else{session.pause();audio.suspend();announce('Game paused.')}mark();refresh();});
 const draw=textButton('Draw',()=>doDraw()),undo=textButton('Undo',()=>doUndo()),hintButton=textButton('Hint',()=>doHint()),auto=textButton('Auto-foundation',()=>{if(busy)return;const moved=session.autoFoundation();if(!moved)audio.invalid();else{audio.place();mark();if(session.won)audio.win();announce(`Moved ${moved} card${moved===1?'':'s'} to foundations.`)}refresh();});
 const drawMode=doc.createElement('select');drawMode.setAttribute('aria-label','Draw mode');drawMode.append(new Option('Draw three','3'),new Option('Draw one','1'));
 const newDeal=textButton('New deal',()=>void restart());
 const openButton=textButton('Open from My files',()=>void open()),saveButton=textButton('Save to My files',()=>void save());
 const path=appInput('Solitaire save path',host.w?.launchContext?.path||'/Solitaire.game.json');
 const folder=textButton('Choose folder',()=>void chooseFolder());
 const soundLabel=make('label','solitaire-setting','Sound effects '),sound=doc.createElement('input'),volumeLabel=make('label','solitaire-setting','Volume '),volume=doc.createElement('input'),motionLabel=make('label','solitaire-setting','Reduce motion '),motion=doc.createElement('input'),contrastLabel=make('label','solitaire-setting','High contrast '),contrast=doc.createElement('input');
 sound.type='checkbox';sound.setAttribute('aria-label','Sound effects');volume.type='range';volume.min='0';volume.max='100';volume.step='5';volume.setAttribute('aria-label','Sound volume');motion.type='checkbox';motion.setAttribute('aria-label','Reduce motion');contrast.type='checkbox';contrast.setAttribute('aria-label','High contrast');soundLabel.prepend(sound);volumeLabel.append(volume);motionLabel.prepend(motion);contrastLabel.prepend(contrast);
 const preferencesKey='solitaire-preferences:'+owner;let preferences={sound:false,volume:35,motion:matchMedia('(prefers-reduced-motion: reduce)').matches,contrast:false};try{const saved=JSON.parse(localStorage.getItem(preferencesKey)||'null');if(saved&&typeof saved.sound==='boolean')preferences={...preferences,...saved};}catch{}
 sound.checked=preferences.sound;volume.value=String(Math.max(0,Math.min(100,Number(preferences.volume)||35)));motion.checked=!!preferences.motion;contrast.checked=!!preferences.contrast;audio.setVolume(Number(volume.value)/100);audio.setMuted(!sound.checked);
 const savePreferences=()=>{preferences={sound:sound.checked,volume:Number(volume.value),motion:motion.checked,contrast:contrast.checked};audio.setMuted(!sound.checked);audio.setVolume(Number(volume.value)/100);try{localStorage.setItem(preferencesKey,JSON.stringify(preferences))}catch{}};
 sound.addEventListener('change',()=>{savePreferences();if(sound.checked)audio.unlock();refresh()});volume.addEventListener('input',savePreferences);motion.addEventListener('change',savePreferences);contrast.addEventListener('change',savePreferences);drawMode.addEventListener('change',()=>{if(busy)return;session.drawMode=drawMode.value==='1'?1:3;mark();refresh()});
 settings.append(make('summary','','Settings'),soundLabel,volumeLabel,motionLabel,contrastLabel);help.append(make('summary','','How to play'),make('p','','Build descending tableau runs in alternating colors. Move aces to the foundations and build each suit upward. Tap a face-up card, then a destination. Draw turns over the stock; when it is empty, drawing redeals the waste. Hint and Auto-foundation are optional.'));saveDetails.className='solitaire-save';const fields=make('div','solitaire-save-fields');fields.append(path,folder);saveDetails.append(make('summary','','Save location'),fields);
 toolbar.append(drawMode,newDeal,start,pause,draw,undo,hintButton,auto,openButton,saveButton);controls.append(textButton('◀ Previous column',()=>moveKeyboardFocus(-1)),textButton('Next column ▶',()=>moveKeyboardFocus(1)),textButton('Select / move',()=>keyboardActivate()),textButton('Draw card',()=>doDraw()),textButton('Undo',()=>doUndo()),textButton('Pause / resume',()=>{if(busy)return;if(session.paused){session.resume();audio.resume()}else{session.pause();audio.suspend()}mark();refresh()}));element.append(header,toolbar,board,controls,help,settings,saveDetails,warning,status);

 let keyboardColumn=0,keyboardCard=0,keyboardFocusVisible=false;
 let currentLayout: LayoutMetrics = computeLayout(636, 620, 1);

 const pileSpacing=(pile:PileState, L:LayoutMetrics)=>{
  const hidden=pile.cards.length-pile.faceUpCount;
  const nominal=hidden*(L.cardH*0.18)+Math.max(0,pile.faceUpCount-1)*(L.cardH*0.28);
  const availableH=L.statusY-16-L.tableauY-L.cardH;
  return (nominal>availableH&&nominal>0)?Math.max(0.25,availableH/nominal):1;
 };
 const valid=()=>!disposed&&!signal.aborted&&element.isConnected&&owner===host.storage.signedInSubject();
 const announce=(message:string)=>{if(valid())status.textContent=message};
 const setDirty=(value:boolean)=>{state.dirty=value};
 const mark=()=>{state.dirty=true;revision++};
 const setBusy=(value:boolean)=>{busy=value;refresh()};

 const card=(ctx:CanvasRenderingContext2D,L:LayoutMetrics,x:number,y:number,id:number|null,faceUp:boolean,highlight=false)=>{
  ctx.save();ctx.fillStyle=faceUp?'#f7f3e8':'#294f83';
  ctx.beginPath();
  if(ctx.roundRect){ctx.roundRect(x,y,L.cardW,L.cardH,L.cardRadius);}else{ctx.rect(x,y,L.cardW,L.cardH);}
  ctx.fill();
  ctx.strokeStyle=highlight?'#f2c94c':'#d3ccba';
  ctx.lineWidth=highlight?Math.max(3,Math.floor(L.cardW*0.04)):Math.max(1,Math.floor(L.cardW*0.02));
  ctx.stroke();
  if(faceUp&&id!==null){
   ctx.fillStyle=isRed(id)?'#aa302e':'#1d2635';
   ctx.font=L.rankFont;
   ctx.fillText(cardKey(id),x+L.cardW*0.1,y+L.cardH*0.24);
   ctx.font=L.suitFont;
   ctx.fillText(['♥','♣','♦','♠'][Math.floor(id/13)],x+L.cardW*0.55,y+L.cardH*0.78);
  } else if(!faceUp){
   ctx.strokeStyle='#8eb2dc';
   const pad=Math.max(4,Math.floor(L.cardW*0.1));
   ctx.strokeRect(x+pad,y+pad,L.cardW-2*pad,L.cardH-2*pad);
  }
  ctx.restore();
 };

 const drawBoard=()=>{
  const ctx=board.getContext('2d');if(!ctx)return;
  const rect=board.getBoundingClientRect();
  const measuredW=rect.width||board.clientWidth||636;
  const measuredH=rect.height||board.clientHeight||620;
  const dpr=Math.min(window.devicePixelRatio||1,4);
  const L=computeLayout(measuredW,measuredH,dpr);
  currentLayout=L;

  const targetBufW=Math.round(L.w*dpr);
  const targetBufH=Math.round(L.h*dpr);
  if(board.width!==targetBufW||board.height!==targetBufH){
   board.width=targetBufW;
   board.height=targetBufH;
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);

  ctx.clearRect(0,0,L.w,L.h);
  ctx.fillStyle=contrast.checked?'#071c16':'#145847';
  ctx.fillRect(0,0,L.w,L.h);
  ctx.strokeStyle=contrast.checked?'#fff':'#95b8aa';
  ctx.lineWidth=Math.max(1,Math.floor(L.cardW*0.02));

  // Stock
  ctx.strokeRect(L.stockX,L.topY,L.cardW,L.cardH);
  ctx.fillStyle='#dce9e4';
  ctx.font=L.rankFont;
  ctx.fillText(session.stock.length?`Stock ${session.stock.length}`:'Redeal',L.stockX+6,L.topY+L.cardH*0.5);

  // Waste
  if(session.waste.length){
   const id=session.waste[session.waste.length-1];
   card(ctx,L,L.wasteX,L.topY,id,true,selected?.from==='waste');
  }

  // Foundations
  for(let i=0;i<4;i++){
   const x=L.foundationX+i*L.foundationStep;
   ctx.strokeRect(x,L.topY,L.cardW,L.cardH);
   const id=session.foundations[i].at(-1);
   if(id!==undefined)card(ctx,L,x,L.topY,id,true,selected?.from==='foundation'&&selected.index===i);
  }

  // Tableau
  for(let col=0;col<TABLEAU_COUNT;col++){
   const x=L.margin+col*L.colWidth;
   const pile=session.tableau[col];
   const faceStart=Math.max(0,pile.cards.length-pile.faceUpCount);
   const spacing=pileSpacing(pile,L);
   if(!pile.cards.length){
    ctx.strokeRect(x,L.tableauY,L.cardW,L.cardH);
    continue;
   }
   let y=L.tableauY;
   pile.cards.forEach((id,index)=>{
    const face=index>=faceStart;
    card(ctx,L,x,y,id,face,selected?.from==='tableau'&&selected.index===col&&selected.cardIndex<=index&&index>=faceStart);
    y+=(face?L.cardH*0.28:L.cardH*0.18)*spacing;
   });
  }

  // Keyboard Focus
  if(keyboardFocusVisible){
   ctx.save();
   ctx.strokeStyle='#77d9ff';
   ctx.lineWidth=3;
   ctx.strokeRect(L.margin+keyboardColumn*L.colWidth-2,L.tableauY-4,L.cardW+4,L.statusY-L.tableauY);
   ctx.restore();
  }

  // Footer status line
  ctx.fillStyle='#f6f8f7';
  ctx.font=L.footerFont;
  ctx.fillText(`Moves ${session.moves} · Score ${session.score} · Redeals ${session.redeals} · ${formatTime(session.elapsedMs)}`,L.margin,L.statusY);
 };

 const formatTime=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
 const refresh=()=>{
  drawMode.value=String(session.drawMode);
  drawMode.disabled=busy;
  start.textContent=session.paused?'Start / resume':'Restart round';
  start.disabled=busy||!session.paused;
  pause.textContent=session.paused?'Resume':'Pause';
  pause.setAttribute('aria-label',pause.textContent);
  pause.disabled=busy||session.won;
  undo.disabled=busy||!session.undoStack.length||session.won;
  draw.disabled=busy||session.paused||session.won;
  hintButton.disabled=busy;
  auto.disabled=busy;
  newDeal.disabled=busy;
  openButton.disabled=busy;
  saveButton.disabled=busy;
  path.disabled=busy;
  folder.disabled=busy;
  const summary=`${session.won?'You won!':session.paused?'Paused':'Playing'} · moves ${session.moves} · foundations ${session.foundations.reduce((n,p)=>n+p.length,0)}/52`;
  if(lastSummary!==summary){lastSummary=summary;announce(summary)}
  drawBoard();
 };
 const markAndRefresh=()=>{mark();refresh()};
 const doDraw=()=>{if(busy)return;if(session.paused){announce('Press Start or Resume before drawing.');return}const before=session.moves;session.draw();if(session.moves!==before){audio.draw();selected=null;markAndRefresh()}else announce('No cards to draw.')};
 const doUndo=()=>{if(busy)return;if(session.undo()){selected=null;audio.place();markAndRefresh()}else announce('Nothing to undo.')};
 const doHint=()=>{if(busy)return;hint=session.hint();if(hint){audio.hint();announce(`Hint: ${hint.from} to ${hint.to}.`)}else{audio.invalid();announce('No legal move found. Try drawing.')}};
 const attempt=(source:Selection,dest:{to:'tableau'|'foundation';toIndex:number})=>{const count=source.from==='tableau'?session.tableau[source.index].cards.length-source.cardIndex:1;const request:MoveRequest={from:source.from,fromIndex:source.index,count,to:dest.to,toIndex:dest.toIndex};const result=session.commitMove(request);selected=null;if(result.ok){audio.place();if(session.won)audio.win();markAndRefresh()}else{audio.invalid();announce('Invalid move: '+result.reason);refresh()}};

 const hit=(event:PointerEvent)=>{
  if(busy)return;
  if(keyboardFocusVisible){keyboardFocusVisible=false;drawBoard()}
  const rect=board.getBoundingClientRect();
  const x=event.clientX-rect.left;
  const y=event.clientY-rect.top;
  const L=currentLayout;

  // Stock
  if(x>=L.stockX&&x<L.stockX+L.cardW&&y>=L.topY&&y<L.topY+L.cardH){
   doDraw();
   return;
  }
  // Waste
  if(x>=L.wasteX&&x<L.wasteX+L.cardW&&y>=L.topY&&y<L.topY+L.cardH){
   if(!selected&&session.waste.length){selected={from:'waste',index:session.waste.length-1};refresh()}
   return;
  }
  // Foundation
  if(y>=L.topY&&y<L.topY+L.cardH&&x>=L.foundationX){
   const foundation=Math.floor((x-L.foundationX)/L.foundationStep);
   if(foundation>=0&&foundation<4&&x<L.foundationX+foundation*L.foundationStep+L.cardW){
    if(selected)attempt(selected,{to:'foundation',toIndex:foundation});
    else if(session.foundations[foundation].length)selected={from:'foundation',index:foundation};
    refresh();
    return;
   }
  }
  // Tableau
  if(y>=L.tableauY){
   const col=Math.floor((x-L.margin)/L.colWidth);
   if(col>=0&&col<TABLEAU_COUNT&&x<L.margin+col*L.colWidth+L.cardW){
    if(selected){attempt(selected,{to:'tableau',toIndex:col});return}
    const pile=session.tableau[col];
    if(!pile.cards.length)return;
    const faceStart=Math.max(0,pile.cards.length-pile.faceUpCount);
    let yPos=L.tableauY,index=-1;
    const spacing=pileSpacing(pile,L);
    for(let i=0;i<pile.cards.length;i++){
     const step=(i<faceStart?L.cardH*0.18:L.cardH*0.28)*spacing;
     if(y>=yPos&&y<yPos+L.cardH)index=i;
     yPos+=step;
    }
    if(index>=faceStart){selected={from:'tableau',index:col,cardIndex:index};refresh()}
   }
  }
 };

 board.addEventListener('pointerdown',hit);
 board.addEventListener('focus',()=>{keyboardFocusVisible=true;refresh()});
 board.addEventListener('blur',()=>{keyboardFocusVisible=false;refresh()});

 const moveKeyboardFocus=(delta:number)=>{if(busy)return;keyboardFocusVisible=true;keyboardColumn=(keyboardColumn+delta+TABLEAU_COUNT)%TABLEAU_COUNT;const top=session.tableau[keyboardColumn].cards.at(-1);keyboardCard=Math.max(0,session.tableau[keyboardColumn].cards.length-1);refresh();announce(`Column ${keyboardColumn+1}, ${top===undefined?'empty':cardKey(top)}`)};
 const keyboardActivate=()=>{if(busy)return;keyboardFocusVisible=true;if(session.paused){announce('Press Start or Resume before moving cards.');return}if(!selected){const pile=session.tableau[keyboardColumn];if(!pile.cards.length){announce('This column is empty.');return}selected={from:'tableau',index:keyboardColumn,cardIndex:pile.cards.length-1};refresh();announce(`Selected ${cardKey(pile.cards.at(-1)!)}. Choose a destination column.`);return}attempt(selected,{to:'tableau',toIndex:keyboardColumn})};
 const keyboard=(event:KeyboardEvent)=>{if(busy)return;if(event.target instanceof Element&&event.target.closest('input,textarea,select,button,[contenteditable=true]'))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();doUndo();return}if(event.key==='Escape'){event.preventDefault();if(session.paused)session.resume();else session.pause();mark();refresh();return}if(event.key===' '){event.preventDefault();doDraw();return}if(event.key.toLowerCase()==='h'){event.preventDefault();doHint();return}if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();moveKeyboardFocus(event.key==='ArrowLeft'?-1:1)}else if(event.key==='Enter'){event.preventDefault();keyboardActivate()}};
 const suspend=()=>{const wasRunning=!session.paused;session.pause();audio.suspend();selected=null;if(wasRunning)mark();refresh()};const blur=()=>suspend();const visibility=()=>{if(document.hidden)suspend()};element.addEventListener('keydown',keyboard);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);

 const resizeObserver=new ResizeObserver(()=>{if(!disposed&&element.isConnected)drawBoard()});
 resizeObserver.observe(element);

 function clearWatch(){watchSerial++;unwatch();unwatch=()=>{};warning.hidden=true}
 function watch(context:FileContext,filePath:string,version:string){clearWatch();const serial=watchSerial;const check=async()=>{if(!valid()||!context.valid()||savedPath!==filePath||savedVersion!==version)return;try{const current=context.files.stat?await context.files.stat(filePath):await context.files.read(filePath);if(serial===watchSerial&&(current.status==='conflict'||current.version!==version)){warning.textContent=current.status==='conflict'?'This save has conflicting copies. Your current table is unchanged; resolve the copies in Files.':'The saved table changed. Save a copy or reopen it when convenient.';warning.hidden=false}}catch{if(serial===watchSerial){warning.textContent='The saved table is unavailable. Your current game is unchanged.';warning.hidden=false}}};unwatch=context.files.subscribe?.(check)||(()=>{});queueMicrotask(check)}
 async function restart(){if(busy||!valid())return;setBusy(true);session.pause();refresh();const atRevision=revision,before=encodeSave(session),requestedMode=drawMode.value;try{if(state.dirty&&!await host.ui.confirm?.('Start a new deal and discard current progress?',{title:'New Solitaire deal',confirmLabel:'New deal',cancelLabel:'Keep game',danger:true,signal})){announce('Current deal kept.');return}if(!valid())return;if(revision!==atRevision||encodeSave(session)!==before||drawMode.value!==requestedMode)throw Error('The table changed while confirming. Try again.');clearWatch();session=new SolitaireSession(`deal-${Date.now()}`,requestedMode==='1'?1:3);session.pause();selected=null;savedPath=null;savedVersion=null;if(host.w)delete host.w.launchContext;setDirty(false);revision++;path.value='/Solitaire.game.json';hint=null;lastSummary='';announce('New deal ready. Press Start or Resume to play.')}catch(error){announce('Could not start a new deal: '+(error instanceof Error?error.message:'unknown error'))}finally{setBusy(false)}}
 async function chooseFolder(){try{const dir=await host.storage.pickFolder({signal});if(dir===null||!valid())return;const context=await host.storage.mirrorFileContext();if(!valid()||!context.valid())return;path.value=context.path((dir==='/'?'':dir)+'/'+context.name(path.value.split('/').pop()||'Solitaire.game.json'))}catch(error){announce('Could not choose folder: '+(error instanceof Error?error.message:'unknown error'))}}
 async function save(){if(busy||!valid())return;const wasDirty=state.dirty;setBusy(true);session.pause();refresh();const atRevision=revision,text=encodeSave(session),requested=path.value;setDirty(true);let committed=false;try{const context=await host.storage.mirrorFileContext(),target=context.path(requested);if(!target.toLowerCase().endsWith('.game.json'))throw Error('Use a .game.json file name.');let expected:string|null=null;try{const existing=context.files.stat?await context.files.stat(target):await context.files.read(target);if(existing.status==='conflict')throw Error('Resolve the conflict in Files first.');if(target===savedPath&&savedVersion){if(existing.version!==savedVersion)throw Error('The saved table changed. Save a copy or reopen it.')}else if(!await host.ui.confirm?.('Replace '+target+'?',{title:'Replace saved game',confirmLabel:'Replace',cancelLabel:'Cancel',danger:true,signal})){announce('Save cancelled. Game remains paused.');return}expected=existing.version}catch(error){if(!(error instanceof Error)||error.message!=='File not found.')throw error;if(target===savedPath&&savedVersion)throw Error('The saved table was removed. Save a copy or reopen it.')}if(!valid()||!context.valid())return;const result=await context.files.write(target,new TextEncoder().encode(text),expected);if(!valid()||!context.valid())return;savedPath=target;savedVersion=result.version;if(path.value===requested)path.value=target;if(host.w){host.w.launchContext=Object.freeze({version:1,storage:'mirror',path:target,owner});host.w.title=target.split('/').pop()+' — Solitaire Table'}const newer=revision!==atRevision||encodeSave(session)!==text;setDirty(newer);committed=true;watch(context,target,result.version);announce(result.status==='conflict'?'Saved on this device with conflicting copies. Resolve them in Files.':newer?'Saved the earlier table; newer game changes remain unsaved.':'Saved to My files; syncing with the server.')}catch(error){announce('Could not save: '+(error instanceof Error?error.message:'unknown error'))}finally{if(!committed&&valid()&&revision===atRevision)setDirty(wasDirty);setBusy(false)}}
 async function open(selectedPath?:string){if(busy||!valid())return;const currentSession=session;setBusy(true);session.pause();refresh();const before=encodeSave(session),atRevision=revision;try{if(state.dirty&&!await host.ui.confirm?.('Open a saved game and discard current progress?',{title:'Unsaved table',confirmLabel:'Discard progress',cancelLabel:'Keep game',danger:true,signal})){announce('Game paused. Current deal kept.');return}if(!valid())return;if(session!==currentSession||revision!==atRevision||encodeSave(session)!==before)throw Error('The table changed while confirming. Try again.');const choice=selectedPath||await host.storage.pickFile({extensions:['.json'],signal});if(!choice||!valid())return;const context=await host.storage.mirrorFileContext(),target=context.path(choice),file=await context.files.read(target);if(!valid()||!context.valid())return;if(file.status==='conflict')throw Error('Resolve the conflict in Files first.');if(file.data.byteLength>8*1024*1024)throw Error('Save file is too large.');const restored=sessionFromSave(decodeSave(new TextDecoder('utf-8',{fatal:true}).decode(file.data)));restored.pause();if(!valid()||!context.valid())return;if(session!==currentSession||revision!==atRevision||encodeSave(session)!==before)throw Error('The table changed while opening. Try again.');session=restored;drawMode.value=String(session.drawMode);savedPath=target;savedVersion=file.version;path.value=target;selected=null;hint=null;setDirty(false);if(host.w){host.w.launchContext=Object.freeze({version:1,storage:'mirror',path:target,owner});host.w.title=target.split('/').pop()+' — Solitaire Table'}lastSummary='';watch(context,target,file.version);queueMicrotask(()=>{if(valid())announce('Game loaded and paused. Press Resume to play.')})}catch(error){announce('Could not open game: '+(error instanceof Error?error.message:'unknown error'))}finally{setBusy(false)}}
 let observedWindow:HTMLElement|null=null;const windowObserver=new MutationObserver(()=>{if(observedWindow&&(observedWindow.hidden||!observedWindow.classList.contains('focused')||observedWindow.classList.contains('rolled')))suspend()});
 const watchWindow=()=>{const target=element.closest<HTMLElement>('.window');if(target!==observedWindow){windowObserver.disconnect();observedWindow=target;if(target)windowObserver.observe(target,{attributes:true,attributeFilter:['class','hidden']})}if(target&&(target.hidden||!target.classList.contains('focused')||target.classList.contains('rolled')))suspend()};
 const loop=(now:number)=>{if(disposed)return;watchWindow();if(!session.paused)session.advance(now-last);last=now;if(!session.paused)refresh();frame=requestAnimationFrame(loop)};last=performance.now();frame=requestAnimationFrame(loop);refresh();
 if(host.w?.launchContext?.storage==='mirror'&&host.w.launchContext.owner===owner){const initialPath=host.w.launchContext.path;path.value=initialPath;const openWhenConnected=(attempt=0):void=>{if(disposed||signal.aborted)return;if(!element.isConnected&&attempt<60)setTimeout(()=>openWhenConnected(attempt+1),16);else if(valid())void open(initialPath)};queueMicrotask(()=>openWhenConnected())}
 return{element,dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);clearWatch();resizeObserver.disconnect();windowObserver.disconnect();board.removeEventListener('pointerdown',hit);element.removeEventListener('keydown',keyboard);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);audio.dispose();element.replaceChildren()}};
}

import {describe,expect,it} from 'vitest';
import {CARD_COUNT,SolitaireSession,type MoveRequest} from '../src/model/solitaire.js';

function uniqueCards(session:SolitaireSession):boolean{
 const cards=session.allCards();
 return cards.length===CARD_COUNT&&new Set(cards).size===CARD_COUNT;
}

describe('Solitaire rules',()=>{
 it('keeps 52 unique cards after repeated legal hints',()=>{
  const session=new SolitaireSession('count',3);
  expect(uniqueCards(session)).toBe(true);
  for(let i=0;i<24;i++){
   const hint=session.hint();
   if(hint===null)break;
   expect(session.commitMove(hint).ok).toBe(true);
   expect(uniqueCards(session)).toBe(true);
  }
 });
 it('invalid drops preserve every pile and score',()=>{
  const session=new SolitaireSession('invalid',3),before=session.snapshot();
  const invalid:MoveRequest={from:'tableau',fromIndex:0,count:1,to:'tableau',toIndex:1};
  expect(session.commitMove(invalid).ok).toBe(false);
  expect(session.snapshot()).toEqual(before);
 });
 it('undo restores reveal, stock, waste and counters',()=>{
  const session=new SolitaireSession('undo',1),hint=session.hint();
  expect(hint).not.toBeNull();
  const before=session.snapshot();
  expect(session.commitMove(hint!).ok).toBe(true);
  expect(session.undo()).toBe(true);
  expect(session.snapshot()).toEqual(before);
 });
 it('draw-one and redeal follow documented order',()=>{
  const session=new SolitaireSession('redeal',1),stock=session.stock.length;
  for(let i=0;i<stock;i++)session.draw();
  expect(session.stock).toHaveLength(0);
  expect(session.waste).toHaveLength(stock);
  session.draw();
  expect(session.stock).toHaveLength(stock);
  expect(session.waste).toHaveLength(0);
  expect(session.redeals).toBe(1);
 });
 it('auto-foundation only runs after an explicit call',()=>{
  const session=new SolitaireSession('auto',3);
  expect(session.score).toBe(0);
  session.autoFoundation();
  expect(uniqueCards(session)).toBe(true);
 });
});

describe('tableau and stock behavior',()=>{
 it('moves an exposed run by source column, flips the source and supports undo',()=>{
  const s=new SolitaireSession('fixture',1);s.tableau=[{cards:[4],faceUpCount:1},{cards:[9,7,19],faceUpCount:2},{cards:[21],faceUpCount:1},...Array.from({length:4},()=>({cards:[],faceUpCount:0}))];
  const before=s.snapshot();const req:MoveRequest={from:'tableau',fromIndex:1,count:2,to:'tableau',toIndex:2};expect(s.commitMove(req)).toEqual({ok:true,reason:null});expect(s.tableau[1]).toEqual({cards:[9],faceUpCount:1});expect(s.tableau[2]).toEqual({cards:[21,7,19],faceUpCount:3});expect(s.undo()).toBe(true);expect(s.snapshot()).toEqual(before);
 });
 it('rejects hidden cards, same pile and invalid indices without changing state',()=>{
  const s=new SolitaireSession('fixture',1);s.tableau[2]={cards:[9,7],faceUpCount:1};const before=s.snapshot();
  for(const req of [{from:'tableau',fromIndex:2,count:2,to:'tableau',toIndex:1},{from:'tableau',fromIndex:2,count:1,to:'tableau',toIndex:2},{from:'tableau',fromIndex:99,count:1,to:'foundation',toIndex:0}] as MoveRequest[])expect(s.commitMove(req).ok).toBe(false);expect(s.snapshot()).toEqual(before);
 });
 it('draws the actual top card and restores stock order after recycling',()=>{
  const s=new SolitaireSession('fixture',3);s.stock=[0,1,2,3];s.waste=[];s.wasteVisibleFrom=0;s.draw();expect(s.waste).toEqual([3,2,1]);expect(s.stock).toEqual([0]);s.draw();expect(s.waste).toEqual([3,2,1,0]);s.draw();expect(s.stock).toEqual([0,1,2,3]);expect(s.waste).toEqual([]);s.draw();expect(s.waste).toEqual([3,2,1]);expect(s.undo()).toBe(true);expect(s.stock).toEqual([0,1,2,3]);
 });
 it('moves only the exposed waste card, not an earlier card in the draw',()=>{
  const s=new SolitaireSession('fixture',3);s.stock=[0,13,26];s.waste=[];s.wasteVisibleFrom=0;s.foundations=[[],[],[],[]];s.draw();expect(s.waste).toEqual([26,13,0]);expect(s.commitMove({from:'waste',fromIndex:0,count:1,to:'foundation',toIndex:2}).ok).toBe(false);expect(s.commitMove({from:'waste',fromIndex:2,count:1,to:'foundation',toIndex:0}).ok).toBe(true);expect(s.waste).toEqual([26,13]);expect(s.foundations[0]).toEqual([0]);
 });
});

describe('winning and restoring a completed deal',()=>{
 it('moves the four remaining kings to foundations and can undo and replay the win',()=>{
  const s=new SolitaireSession('winning',1);s.stock=[];s.waste=[];s.wasteVisibleFrom=0;
  s.foundations=Array.from({length:4},(_,suit)=>Array.from({length:12},(_,rank)=>suit*13+rank));
  s.tableau=Array.from({length:7},(_,pile)=>pile<4?{cards:[pile*13+12],faceUpCount:1}:{cards:[],faceUpCount:0});
  const before=s.snapshot();for(let pile=0;pile<4;pile++){expect(s.commitMove({from:'tableau',fromIndex:pile,count:1,to:'foundation',toIndex:pile}).ok).toBe(true);expect(s.allCards()).toHaveLength(52);expect(new Set(s.allCards()).size).toBe(52)}
  expect(s.won).toBe(true);expect(s.foundations.map(p=>p.length)).toEqual([13,13,13,13]);expect(s.moves).toBe(before.moves+4);expect(s.undo()).toBe(true);expect(s.won).toBe(false);expect(s.tableau[3].cards).toEqual([51]);expect(s.commitMove({from:'tableau',fromIndex:3,count:1,to:'foundation',toIndex:3}).ok).toBe(true);expect(s.won).toBe(true);
 });
});

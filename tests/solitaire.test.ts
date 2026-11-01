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

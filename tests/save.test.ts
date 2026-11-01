import {describe,expect,it} from 'vitest';
import {decodeSave,encodeSave,SAVE_APP_ID,sessionFromSave} from '../src/model/save.js';
import {SolitaireSession} from '../src/model/solitaire.js';

describe('Solitaire save codec',()=>{
 it('round-trips exact logical state including stock and undo',()=>{
  const session=new SolitaireSession('roundtrip',3);
  session.draw();
  const hint=session.hint();
  if(hint!==null)session.commitMove(hint);
  const restored=sessionFromSave(decodeSave(encodeSave(session)));
  expect(restored.snapshot()).toEqual(session.snapshot());
 });
 it('rejects wrong app ids and duplicate cards',()=>{
  const envelope=JSON.parse(encodeSave(new SolitaireSession('reject',1)));
  expect(envelope.appId).toBe(SAVE_APP_ID);
  envelope.payload.stock=[...envelope.payload.waste.slice(0,1),...envelope.payload.stock.slice(1)];
  expect(()=>decodeSave(JSON.stringify(envelope))).toThrow(/unique cards/);
  envelope.appId='another-game';
  expect(()=>decodeSave(JSON.stringify(envelope))).toThrow(/wrong app id/);
 });
 it('rejects unsupported builds and malformed counters',()=>{
  const bad=JSON.parse(encodeSave(new SolitaireSession('bad',3)));
  bad.gameBuild='older';
  expect(()=>decodeSave(JSON.stringify(bad))).toThrow(/unsupported rules version/);
  const counter=JSON.parse(encodeSave(new SolitaireSession('counter',3)));
  counter.payload.moves=-1;
  expect(()=>decodeSave(JSON.stringify(counter))).toThrow(/invalid counters/);
 });
});

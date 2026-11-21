import {describe,expect,it} from './test-shim.ts';
import {mount} from '../src/mount.ts';

function make(_tag:string,className='',text=''):HTMLElement{
 const classes=new Set(className.split(/\s+/).filter(Boolean));
 return {
  className,
  textContent:text,
  isConnected:true,
  classList:{contains:(value:string)=>classes.has(value)},
  append(){},
  replaceChildren(){},
  setAttribute(){},
 } as unknown as HTMLElement;
}

describe('Solitaire desktop mount',()=>{
 it('returns synchronously and disposes idempotently before startup',()=>{
  const controller=new AbortController(),result=mount({signal:controller.signal,ui:{make}});
  expect(result.element.classList.contains('solitaire-app')).toBe(true);
  controller.abort();
  result.dispose();
  result.dispose();
 });
});

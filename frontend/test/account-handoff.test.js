import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { WORKFLOW } from '../../backend/src/config/workflow.js';

test('accounting inbox renders every request type routed by the backend workflow', async t=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),mode:'demo',server:{middlewareMode:true,open:false,ws:false},appType:'custom'});
  const oldStorage=globalThis.localStorage;t.after(async()=>{await server.close();if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;});
  const {ACCOUNTANT_APPROVAL_TYPES,pendingForAccountant,canDecide}=await server.ssrLoadModule('/src/views/Account_Manager/AccountData.jsx');
  const {AdminPreferencesProvider}=await server.ssrLoadModule('/src/views/AdminPreferences.jsx');
  const {default:Approvals}=await server.ssrLoadModule('/src/views/Account_Manager/components/AccountApprovals.jsx');
  const {default:Overview}=await server.ssrLoadModule('/src/views/Account_Manager/components/AccountOverview.jsx');
  assert.deepEqual([...ACCOUNTANT_APPROVAL_TYPES].sort(),[...WORKFLOW.PENDING_ACCOUNTANT.types].sort());
  const actor={id:'accountant',role:'accountant'};
  const rows=WORKFLOW.PENDING_ACCOUNTANT.types.map(type=>({_id:type,title:`Received ${type}`,type,amount:100,author:{_id:'employee',name:'Original sender'},status:'PENDING_ACCOUNTANT'}));
  for(const row of rows){assert.equal(pendingForAccountant(row),true);assert.equal(canDecide(row,actor),true);assert.equal(canDecide({...row,status:'PENDING_MANAGER'},actor),false);assert.equal(canDecide({...row,author:{_id:actor.id}},actor),false);}
  assert.equal(canDecide({...rows[0],type:'OVERTIME'},actor),false);
  for(const lang of ['vi','en']){
    globalThis.localStorage={getItem:()=>JSON.stringify({lang,theme:'dark'}),setItem:()=>{}};
    const render=component=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(AdminPreferencesProvider,null,component)));
    const list=render(React.createElement(Approvals,{requests:rows,user:actor}));const overview=render(React.createElement(Overview,{requests:rows}));
    for(const row of rows){assert.ok(list.includes(row.title));assert.ok(overview.includes(row.title));}
    assert.ok(list.includes(lang==='en'?'Business trip':'Công tác'));assert.ok(list.includes(lang==='en'?'Training':'Đào tạo'));
    assert.equal((list.match(/class="acc-review-button"/g)||[]).length,3);
  }
});

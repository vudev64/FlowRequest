import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WORKFLOW} from '../../backend/src/config/workflow.js';

test('Manager preserves all request types/details and matches every existing backend next-step rule',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),mode:'demo',server:{middlewareMode:true,ws:false,open:false},appType:'custom'});
 try{
  const m=await server.ssrLoadModule('/src/views/Manager/ManagerData.jsx');
  const {RequestCard}=await server.ssrLoadModule('/src/views/Manager/components/RequestCard.jsx');
  const {ApprovalModal}=await server.ssrLoadModule('/src/views/Manager/components/ApprovalModal.jsx');
  const roles={PENDING_DIRECTOR:'Director',PENDING_ACCOUNTANT:'Accountant',PENDING_HRADMIN:'HR_ADMIN',APPROVED:'Đã hoàn tất'};
  for(const[status,step]of Object.entries(WORKFLOW))for(const type of new Set(step.types))for(const amount of [0,1000,49_999_999,50_000_000]){
   const request={_id:'fixture',status,type,amount,requiresDirector:type==='PURCHASE'&&amount>=50_000_000,author:{name:'Fixture user',department:'Fixture'},leaveDays:0.5,overtimeHours:2,startDate:'2026-11-23',endDate:'2026-11-23',extraDetails:{destination:'Fixture destination',purpose:'Fixture purpose',fromDate:'2026-11-23',toDate:'2026-11-24'}};
   const mapped=m.mapApiRequestToManager(request);assert.equal(mapped.rawType,type);assert.equal(mapped.nextRole,roles[step.next(request)],type+':'+status+':'+amount);
   assert.notEqual(mapped.type,'UNKNOWN');if(type!=='PURCHASE')assert.notEqual(mapped.type,'PURCHASE');
   assert.equal(mapped.extraDetails,request.extraDetails);
   const html=renderToStaticMarkup(React.createElement(RequestCard,{request:mapped}));assert.ok(html.includes(m.typeMeta[mapped.type].label));
  }
  const leave=m.mapApiRequestToManager({_id:'leave',type:'LEAVE',status:'PENDING_MANAGER',author:{name:'Fixture'},leaveDays:0.5,startDate:'2026-11-23',endDate:'2026-11-24',leaveType:'PERSONAL'});
  assert.equal(leave.metricLabel,'ngày');assert.notEqual(leave.metric,'0');
  const modal=renderToStaticMarkup(React.createElement(ApprovalModal,{kind:'approve',request:leave}));assert.ok(modal.includes('Nghỉ việc riêng'));assert.ok(modal.includes('23/11/2026'));assert.ok(modal.includes('24/11/2026'));
  const unknown=m.mapApiRequestToManager({_id:'future',type:'FUTURE',status:'PENDING_MANAGER'});assert.equal(unknown.type,'UNKNOWN');assert.equal(unknown.rawType,'FUTURE');assert.equal(unknown.nextRole,'Chưa xác định');
 }finally{await server.close();}
});


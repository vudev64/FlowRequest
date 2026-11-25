import { testStorageRoot } from '../../backend/test/support/unitTestStorage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import express from '../../backend/node_modules/express/index.js';
import mongoose from '../../backend/node_modules/mongoose/index.js';
import jwt from '../../backend/node_modules/jsonwebtoken/index.js';
import router from '../../backend/src/Router/request.js';
import User from '../../backend/src/models/User.js';
import Request from '../../backend/src/models/Request.js';
import Department from '../../backend/src/models/Department.js';
import AuditLog from '../../backend/src/models/Auditlog.js';
import SystemSettings from '../../backend/src/models/SystemSettings.js';
import { settingsDefaults } from '../../backend/src/config/settingsDefaults.js';

test('every Employee dropdown choice preserves typed fields through the real JSON/multipart API and schema', async t => {
  const vite=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),mode:'demo',server:{middlewareMode:true,ws:false,open:false},appType:'custom'});
  const restore=[],patch=(obj,key,value)=>{const old=obj[key];restore.push(()=>obj[key]=old);obj[key]=value;};
  const secret=process.env.JWT_SECRET;process.env.JWT_SECRET='isolated-employee-contract';
  const actor={_id:new mongoose.Types.ObjectId(),role:'EMPLOYEE',department:'Fixture',status:'ACTIVE'},manager={_id:new mongoose.Types.ObjectId(),role:'MANAGER'};
  const chain=value=>({select(){return this;},maxTimeMS(){return this;},lean:async()=>value,then(a,b){return Promise.resolve(value).then(a,b);}});
  const settings=settingsDefaults();settings.notifications.enabled=false;
  patch(User,'findById',()=>chain(actor));patch(User,'findOne',async()=>manager);
  patch(Department,'findOne',async()=>({_id:new mongoose.Types.ObjectId(),annualBudget:1_000_000_000,usedBudget:0}));
  patch(SystemSettings,'findOne',()=>chain(settings));patch(AuditLog,'create',async()=>({}));
  const created=[];patch(Request,'create',async values=>{const row=new Request(values);await row.validate();created.push(row.toObject());return row;});
  const app=express();app.use(express.json());app.use('/api/request',router);const http=app.listen(0,'127.0.0.1');await new Promise(resolve=>http.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>http.close(resolve));restore.reverse().forEach(fn=>fn());if(secret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=secret;await vite.close();});
  const employee=await vite.ssrLoadModule('/src/views/Employee/EmployeeData.jsx');
  const fields=await vite.ssrLoadModule('/src/views/Employee/components/DynamicRequestFields.jsx');
  const detail=await vite.ssrLoadModule('/src/views/Employee/components/RequestSpecificDetails.jsx');
  const details={leaveType:'ANNUAL',startDate:'2026-11-23',endDate:'2026-11-23',dayPart:'FULL',projectName:'Fixture',overtimeDate:'2026-11-23',startTime:'18:00',endTime:'20:00',itemName:'Fixture device',quantity:'2',unitPrice:'1000',licenseName:'Fixture license',licenseQuantity:'2',licenseMonths:'12',licenseCost:'2000',cloudProvider:'Fixture cloud',cloudResource:'Fixture VM',cloudMonths:'1',cloudCost:'2000',attendanceDate:'2026-11-23',actualCheckIn:'08:00',actualCheckOut:'17:00',fromDate:'2026-11-23',toDate:'2026-11-24',workLocation:'Fixture location',destination:'Fixture destination',purpose:'Fixture purpose',tripCost:'2000',courseName:'Fixture course',provider:'Fixture provider',trainingCost:'2000',position:'Fixture position',headcount:'2',requestedDepartment:'Fixture'};
  const token=jwt.sign({id:actor._id},process.env.JWT_SECRET,{expiresIn:'1h'}),url='http://127.0.0.1:'+http.address().port+'/api/request';
  const send=async(body,multipart=false,file=false)=>{let payload;const headers={Authorization:'Bearer '+token};if(multipart){payload=new FormData();for(const[k,v]of Object.entries(body))payload.set(k,typeof v==='object'?JSON.stringify(v):String(v));if(file)payload.set('attachment',new Blob(['%PDF-1.4\nIsolated fixture'],{type:'application/pdf'}),'fixture.pdf');}else{headers['Content-Type']='application/json';payload=JSON.stringify(body);}const response=await fetch(url,{method:'POST',headers,body:payload});return{status:response.status,body:await response.json()};};
  for(const label of employee.creatableRequestTypeOptions){
    assert.ok(fields.getRequestKind(label),label);assert.equal(fields.validateRequestDetails(label,details),null,label);
    const kind=fields.getRequestKind(label),amount=['DEVICE','LICENSE','CLOUD','TRIP','TRAINING'].includes(kind)?'2000':'0';
    const payload=employee.mapEmployeeDraftToApi({type:label,title:label,description:'Isolated fixture',value:amount,...fields.getRequestExtraPayload(label,details)});
    for(const multipart of [false,true]){const result=await send(payload,multipart);assert.equal(result.status,201,JSON.stringify({label,multipart,error:result.body}));assert.equal(result.body.data.type,payload.type);if(payload.extraDetails)for(const[k,v]of Object.entries(payload.extraDetails)){const actual=result.body.data.extraDetails[k];if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))assert.equal(new Date(actual).toISOString().slice(0,10),v,label+':'+k);else assert.equal(actual,v,label+':'+k);}}
  }
  for(const leaveType of ['ANNUAL','SICK','PERSONAL','UNPAID']){const body=employee.mapEmployeeDraftToApi({type:'Nghỉ phép',title:'Leave',description:'Fixture',...fields.getRequestExtraPayload('Nghỉ phép',{...details,leaveType})});assert.equal((await send(body)).status,201);}
  assert.ok(fields.validateRequestDetails('Nghỉ phép',{...details,leaveType:'OTHER'}));
  const invalid=await send({type:'LEAVE',title:'Invalid',content:'Fixture',leaveType:'OTHER',startDate:details.startDate,endDate:details.endDate});assert.equal(invalid.status,400);
  const wfh=employee.mapEmployeeDraftToApi({type:'Làm việc từ xa',title:'WFH',description:'Fixture',...fields.getRequestExtraPayload('Làm việc từ xa',details)});
  const uploaded=await send(wfh,true,true);assert.equal(uploaded.status,201);assert.ok(await fs.stat(path.join(testStorageRoot,'uploads',path.basename(uploaded.body.data.attachment))));
  for(const amount of [49_999_999,50_000_000]){const result=await send({type:'PURCHASE',title:'Boundary',content:'Fixture',amount,category:'EQUIPMENT',purchaseDetails:{deviceName:'Fixture',quantity:1,unitPrice:amount}});assert.equal(result.status,201);assert.equal(result.body.data.requiresDirector,amount>=50_000_000);}
  const trip=employee.mapApiRequestToEmployee({type:'BUNSINESS_TRIP',amount:2000,extraDetails:fields.getRequestExtraPayload('Đăng ký công tác',details).extraDetails});assert.equal(trip.typeLabel,'Đăng ký công tác');assert.ok(detail.getSpecificDetailFields(trip).fields.some(row=>row.value==='Fixture destination'));
  assert.equal(created.length,27);
});

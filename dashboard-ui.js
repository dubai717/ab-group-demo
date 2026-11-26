(function(root){'use strict';
 const t=(a,b)=>getLocale()==='ar'?a:b,e=v=>CenterForms.esc(v),labels={contractingCompanies:['الشركات المتعاقدة','Contracting companies'],companies:['الشركات','Companies'],banks:['الحسابات البنكية','Bank accounts'],customers:['العملاء','Customers'],vehicles:['المركبات','Vehicles'],invoices:['الفواتير','Invoices'],employees:['الموظفون','Employees'],tasks:['المهام','Tasks'],marketing:['فرص التسويق','Marketing opportunities'],investments:['الاستثمارات','Investments']};
 let movementEpoch=0;let movementData=null,movementError='',userQuery='',previewUser='',previewOpen=false,previewError='';const searches={};
 let targetCache=null;let actor='',epoch=0,data=null,error='',loading=false,company='',asUser='',source='',from='',to='',department='',widgets=Object.keys(labels),sections={charts:true,reports:true,tasks:true,shortcuts:true,alerts:true};
 function sync(){if(actor!==ABCentral.actor?.id){actor=ABCentral.actor?.id;targetCache=null;sections={charts:true,reports:true,tasks:true,shortcuts:true,alerts:true};for(const key of Object.keys(searches))delete searches[key];epoch++;data=null;error='';loading=false;company=asUser=source=from=to=department='';widgets=Object.keys(labels);movementData=null;movementEpoch++;userQuery='';previewUser='';previewOpen=false;previewError='';}}
 async function load(){sync();loading=true;error='';const n=++epoch;const host=document.getElementById('central-dashboard');host?.querySelectorAll('button,input,select').forEach(b=>b.disabled=true);const spinner=setTimeout(()=>{if(n===epoch&&loading&&host?.isConnected)host.insertAdjacentHTML('afterbegin',`<p data-dashboard-loading role="status">${t('جارٍ تحميل السجلات المصرح بها…','Loading authorized records…')}</p>`);},180);try{const q=new URLSearchParams();for(const [k,v]of Object.entries({companyId:company,departmentId:department,asUserId:asUser,from,to}))if(v)q.set(k,v);if(source)q.set('source',source);const [result,targets]=await Promise.all([CenterForms.api('central-dashboard?'+q),(ABCentral.actor?.roleId==='owner'||ABCentral.viewAs)?(targetCache?Promise.resolve({rows:targetCache}):CenterForms.api('view-as/targets')):null,!asUser?MyWorkUI.load({companyId:company,departmentId:department}):null]);if(n!==epoch)return;if(targets){targetCache=targets.rows;result.targets=targets.rows;}data=result;widgets=result.layout.widgets;sections=result.layout.sections||{charts:true,reports:true,tasks:true,shortcuts:true,alerts:true};}catch(err){if(n===epoch){error=t('تعذر تحميل لوحة التحكم. أعد المحاولة؛ لم تُعرض أعداد بديلة. ','Cannot load dashboard. Retry; no replacement counts were shown. ')+err.message;data=null;}}finally{clearTimeout(spinner);if(n===epoch){loading=false;if(app.state.currentPage==='dashboard')render();if(data?.layout.sections.charts&&data.layout.detailWidgets.includes('vehicles')&&data.counts.vehicles!=null&&!department){void loadMovements();}}}}
 const columnNames={nameAr:['الاسم بالعربية','Arabic name'],nameEn:['الاسم بالإنجليزية','English name'],companyName:['الشركة','Company'],tradeLicenseNumber:['رقم الرخصة','License number'],emirate:['الإمارة','Emirate'],status:['الحالة','Status'],number:['رقم الملف','File number'],name:['الاسم','Name'],accountName:['اسم الحساب','Account name'],bankName:['البنك','Bank'],currency:['العملة','Currency'],nationality:['الجنسية','Nationality'],type:['النوع','Type'],plate:['رقم اللوحة','Plate'],customerName:['العميل','Customer'],kind:['النوع','Kind'],dueOn:['تاريخ الاستحقاق','Due date'],amount:['المبلغ','Amount'],paid:['المحصل','Paid'],outstanding:['المتبقي','Outstanding'],title:['العنوان','Title'],jobTitle:['الوظيفة','Job title'],hiredOn:['تاريخ التعيين','Hire date'],stage:['المرحلة','Stage'],mode:['نوع الاستثمار','Investment type'],licenseNumber:['رقم الرخصة','License number'],relationship:['العلاقة التعاقدية','Relationship']};
 const fields={companies:['nameAr','nameEn','tradeLicenseNumber','emirate','status'],contractingCompanies:['nameAr','nameEn','licenseNumber','relationship','status'],banks:['companyName','bankName','accountName','currency','status'],customers:['number','name','nationality','companyName','status'],vehicles:['number','plate','type','customerName','companyName','status'],invoices:['number','companyName','dueOn','currency','amount','paid','outstanding','status'],employees:['number','name','jobTitle','companyName','hiredOn','status'],tasks:['number','title','companyName','dueOn','status'],marketing:['title','companyName','stage'],investments:['companyName','mode','currency','status']};
 function companyName(id){const co=(app.state.companies||[]).find(c=>c.id===id);return co?(getLocale()==='ar'?co.arabicName:co.englishName)||co.arabicName||co.englishName:t('شركة ضمن الصلاحيات','Authorized company');}
 function records(){return(data?.sources[source]||[]).map(row=>{const co=(app.state.companies||[]).find(c=>c.id===row.companyId),bank=source==='banks'?(app.state.bankReference||[]).find(b=>b.id===row.bankId):null;return{...row,companyName:row.companyName||(co?(getLocale()==='ar'?co.arabicName:co.englishName)||co.arabicName||co.englishName:''),...(source==='companies'?{tradeLicenseNumber:co?.tradeLicenseNumber||''}:{}),...(bank?{bankName:getLocale()==='ar'?bank.ar:bank.en}:{})};});}
 function details(){const columns=(fields[source]||[]).map(k=>[k,t(...columnNames[k])]);return `<section class="dashboard-details"><div class="section-head"><h3>${e(t(...labels[source]))}</h3><button class="secondary-btn" type="button" data-dashboard="back">${t('العودة إلى لوحة التحكم','Back to dashboard')}</button></div><form class="register-search" id="dashboard-search"><input class="input" type="search" name="q" value="${e(searches[source]||'')}" aria-label="${t('البحث المركزي','Central search')}"><button class="ghost-btn" type="submit">${t('بحث','Search')}</button></form>${CenterForms.table('dashboard-source:'+actor+':'+asUser+':'+source,records(),columns,searches[source]||'',r=>`<button type="button" class="ghost-btn" data-dashboard-record="${e(r.id)}">${t('فتح الملف','Open profile')}</button>`,{amount:'number',paid:'number',outstanding:'number',dueOn:'date',hiredOn:'date'})}</section>`;}
 function openRecord(id){
  const row=records().find(r=>r.id===id),kind=source;if(!row)throw Error('notFound');
  const fieldsHTML=(fields[kind]||[]).map(key=>'<dt>'+e(t(...columnNames[key]))+'</dt><dd>'+e(row[key]??'—')+'</dd>').join('');
  const d=overlay(t(...labels[kind]),'<dl>'+fieldsHTML+'</dl><button type="button" class="ghost-btn" data-original>'+t('فتح الملف في القسم الأصلي','Open profile in original module')+'</button>');
  d.querySelector('[data-original]').onclick=async()=>{
   try{
    if(kind==='companies')await ABCentral.openCompany(id);
    else if(kind==='customers')await CustomerUI.open(id);
    else if(kind==='vehicles')await VehicleUI.openNotification(id);
    else if(kind==='contractingCompanies'){app.state.currentPage='contractingCompanies';await ContractingCompaniesUI.open(id);}
    else if(kind==='banks')await ABCentral.openBank(id);
    else if(kind==='employees')await PersonnelUI.openProfile(id);
    else if(kind==='investments')await InvestorUI.open(id);
    else await RecordLinks.open(({tasks:'task',invoices:'invoice',marketing:'marketing'})[kind],id);
    for(const entry of [...dialogs].reverse())entry.close();
   }catch(err){const status=document.createElement('p');status.setAttribute('role','alert');status.textContent=err.message;d.querySelector('.ab-board-dialog-body').append(status);}
  };
 }
 async function loadMovements(){const n=++movementEpoch;movementError='';movementData=null;try{const q=new URLSearchParams({months:'36'});for(const[k,v]of Object.entries({companyId:company,from,to}))if(v)q.set(k,v);const result=await CenterForms.api('central-dashboard/vehicle-movements?'+q);if(n===movementEpoch)movementData=result;}catch(err){if(n===movementEpoch)movementError=err.message;}if(n===movementEpoch&&app.state.currentPage==='dashboard')render();}
 function targetName(u){return (getLocale()==='ar'?u.nameAr||u.fullName||u.nameEn:u.nameEn||u.fullName||u.nameAr)||u.username;}
 function previewTargets(){return data.targets.filter(u=>RegisterTools.search([u.nameAr,u.nameEn,u.fullName,u.name,u.username,u.employeeNames,u.employeeNumber,u.roleId,getRoleName(u.roleId),u.departments?.map(d=>d.name)],userQuery));}
 function previewOptions(){return previewTargets().map(u=>`<button type="button" role="option" data-preview-target="${e(u.id)}" aria-selected="${u.id===(previewUser||(ABCentral.viewAs?ABCentral.actor.id:''))}" ${u.previewable===false?'disabled':''}><strong>${e(targetName(u))}</strong><span>${e(u.employeeNumber||t('لا رقم وظيفي مرتبط','No linked employee number'))} · ${e(u.departments?.map(d=>d.name).join('، ')||t('بلا قسم مرتبط','No linked department'))} · ${e(getRoleName(u.roleId))}</span></button>`).join('')||`<p role="status">${t('لا توجد أسماء مطابقة','No matching users')}</p>`;}
 function previewPicker(){const selected=data.targets.find(u=>u.id===(previewUser||(ABCentral.viewAs?ABCentral.actor.id:'')));return `<div class="preview-picker"><div id="preview-picker"><strong>${t('عرض شاشة المستخدم','View user screen')}</strong><label for="dashboard-user-search">${t('ابحث بأي جزء من الاسم أو الرقم أو القسم أو الدور','Search any part of name, number, department or role')}</label><input class="input" type="search" id="dashboard-user-search" value="${e(userQuery)}" autocomplete="off" aria-controls="dashboard-user-options"><button type="button" class="input preview-user-combobox" id="dashboard-as" role="combobox" aria-haspopup="listbox" aria-expanded="${previewOpen}" aria-controls="dashboard-user-options" title="${e(selected?targetName(selected):'')}"><span data-preview-selected>${e(selected?targetName(selected):t('اختر مستخدماً','Choose a user'))}</span><span aria-hidden="true">▾</span></button><div class="preview-user-popup" id="dashboard-user-options" role="listbox" aria-label="${t('المستخدمون المصرح بمعاينتهم','Authorized preview users')}" ${previewOpen?'':'hidden'}>${previewOptions()}</div><p data-preview-selected-details>${selected?e(targetName(selected)+' · '+(selected.employeeNumber||'—')+' · '+(selected.departments?.map(d=>d.name).join('، ')||'—')+' · '+getRoleName(selected.roleId)):''}</p><p role="status" data-preview-count>${previewTargets().length} / ${data.targets.length}</p></div><button type="button" class="secondary-btn" data-dashboard="preview" ${!selected||selected.previewable===false?'disabled':''}>${t('معاينة شاشة الموظف','Preview employee screen')}</button><p role="alert">${e(previewError)}</p>${previewError?`<button class="secondary-btn" type="button" data-dashboard="preview-retry">${t('إعادة محاولة المعاينة','Retry preview')}</button>`:''}</div>`;}
 function bindPreview(host){const button=host.querySelector('#dashboard-as'),popup=host.querySelector('#dashboard-user-options'),input=host.querySelector('#dashboard-user-search');if(!button)return;
 const toggle=value=>{previewOpen=value;popup.hidden=!value;button.setAttribute('aria-expanded',String(value));};
 const choices=()=>[...popup.querySelectorAll('[data-preview-target]:not(:disabled)')];
 const bindChoices=()=>popup.querySelectorAll('[data-preview-target]').forEach(b=>b.onclick=()=>{previewUser=b.dataset.previewTarget;previewError='';const u=data.targets.find(u=>u.id===previewUser);button.querySelector('[data-preview-selected]').textContent=targetName(u);button.title=targetName(u);host.querySelector('[data-preview-selected-details]').textContent=targetName(u)+' · '+(u.employeeNumber||'—')+' · '+(u.departments?.map(d=>d.name).join('، ')||'—')+' · '+getRoleName(u.roleId);popup.querySelectorAll('[role=option]').forEach(n=>n.setAttribute('aria-selected',String(n===b)));host.querySelector('[data-dashboard=preview]').disabled=false;toggle(false);button.focus();ViewAsUI.capturePicker();});
 button.onclick=()=>toggle(!previewOpen);button.onkeydown=event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();toggle(true);choices()[event.key==='ArrowUp'?choices().length-1:0]?.focus();}};
 popup.onkeydown=event=>{const rows=choices(),i=rows.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();event.stopPropagation();toggle(false);button.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?rows.length-1:(i+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows[next]?.focus();}};
 input.oninput=event=>{userQuery=event.target.value;previewUser='';popup.innerHTML=previewOptions();button.querySelector('[data-preview-selected]').textContent=t('اختر مستخدماً','Choose a user');host.querySelector('[data-preview-selected-details]').textContent='';host.querySelector('[data-preview-count]').textContent=previewTargets().length+' / '+data.targets.length;host.querySelector('[data-dashboard=preview]').disabled=true;toggle(true);bindChoices();};bindChoices();
 }
 document.addEventListener('pointerdown',event=>{if(previewOpen&&!event.target.closest('#preview-picker')){previewOpen=false;const p=document.getElementById('dashboard-user-options'),b=document.getElementById('dashboard-as');if(p)p.hidden=true;b?.setAttribute('aria-expanded','false');}});
 const moduleLabels={performance:['الأداء','Performance'],movement:['حركة المركبات الشهرية','Monthly vehicle movements'],financial:['الملخص المالي حسب الشركة','Financial summary by company'],debt:['أعلى الجهات مديونية','Largest debtors'],items:['أعلى البنود المستحقة','Largest outstanding items'],contracts:['العقود حسب الشركة','Contracts by company'],emirates:['الشركات حسب الإمارة','Companies by emirate'],investors:['ملخص المستثمرين حسب الشركة','Investors by company'],banks:['رصد البنوك','Bank monitoring'],counts:['أعداد السجلات','Record counts'],tasks:['المهام','Tasks']};
 const moduleDefaults=Object.keys(moduleLabels).map(id=>({id,visible:true,size:['debt','items','contracts','emirates'].includes(id)?'small':id==='banks'?'medium':'wide'}));
 const missing=()=>t('لا توجد بيانات كافية','Insufficient data');
 const number=value=>value==null?'—':new Intl.NumberFormat(getLocale()).format(value);
 const money=(value,currency)=>value==null?'—':new Intl.NumberFormat(getLocale(),{style:'currency',currency,maximumFractionDigits:3}).format(value);
 const todayDubai=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date());
 const moduleTitle=id=>t(...moduleLabels[id]);
 const tableView=(headers,rows)=>rows.length?'<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(value=>'<td>'+value+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p>'+missing()+'</p>';
 const action=(label,id)=>'<button type="button" class="ghost-btn" data-board-action="'+e(id)+'">'+e(label)+'</button>';
 const dialogs=[];
 function overlay(title,body){
  const opener=document.activeElement,d=document.createElement('dialog');
  d.className='ab-board-dialog';d.dir=document.documentElement.dir|| (getLocale()==='ar'?'rtl':'ltr');
  const previous=dialogs.at(-1),scrollParent=previous?.querySelector('.ab-board-dialog-body');
  const scroll=scrollParent?{top:scrollParent.scrollTop,left:scrollParent.scrollLeft}:{top:window.scrollY,left:window.scrollX};
  if(previous)previous.classList.add('ab-board-underlay');
  d.innerHTML='<header><h2>'+e(title)+'</h2><button type="button" aria-label="'+t('إغلاق','Close')+'">×</button></header><div class="ab-board-dialog-body">'+body+'</div>';
  document.body.append(d);dialogs.push(d);d.querySelector('header button').onclick=()=>d.close();
  d.addEventListener('close',()=>{dialogs.splice(dialogs.indexOf(d),1);d.remove();previous?.classList.remove('ab-board-underlay');if(opener?.isConnected)opener.focus({preventScroll:true});if(scrollParent?.isConnected)scrollParent.scrollTo(scroll);else if(!previous)window.scrollTo(scroll);},{once:true});
  boardActions(d);d.showModal();return d;
 }
 function layoutFor(model){
  const saved=model.layout.modules||[];
  return [...saved,...moduleDefaults.filter(item=>!saved.some(row=>row.id===item.id))];
 }
 function taskRows(model,filter){
  const rows=model.panels?.tasks||[],day=todayDubai();
  return rows.filter(row=>filter==='today'?row.dueOn===day:filter==='late'?row.dueOn&&row.dueOn<day&&!finishedTask(row):!finishedTask(row));
 }
 const finishedTask=row=>['Done','Completed','Cancelled','Closed'].includes(row.status);
 const taskTable=(rows,readOnly)=>tableView([t('المهمة','Task'),t('الشركة','Company'),t('المسؤول','Assignee'),t('الاستحقاق','Due'),t('الحالة','Status')],rows.map(row=>[readOnly?e(row.title):action(row.title,'task:'+row.id),e(companyName(row.companyId)),e(row.assignee||'—'),e(row.dueOn||'—'),e(row.status)]));
 let taskFilter='today';
 function performance(model,readOnly){
  const scores=(model.overview?.evaluations||[]).filter(row=>row.score!==null);
  const companies=new Map();
  for(const row of scores){const list=companies.get(row.companyId)||[];list.push(row);companies.set(row.companyId,list);}
  const mean=rows=>rows.length?rows.reduce((sum,row)=>sum+row.score,0)/rows.length:null;
  const label=value=>value==null?missing():new Intl.NumberFormat(getLocale(),{style:'percent',maximumFractionDigits:1}).format(value/10000);
  const states=[...companies.values()].map(rows=>rows.every(row=>row.minimumScore!=null)?mean(rows)>=rows.reduce((sum,row)=>sum+row.minimumScore,0)/rows.length:null);
  const marketing=model.overview?.marketing;
  const completed=(model.panels?.tasks||[]).filter(r=>r.completedAt&&r.dueOn);
  const within=completed.filter(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date(r.completedAt))<=r.dueOn).length;
  const business=model.overview.marketingCompanies||[], hasTarget=business.length&&business.every(r=>r.target!=null), count=business.reduce((sum,r)=>sum+r.contracts.filter(c=>c.state!=='Draft').length,0),target=business.reduce((sum,r)=>sum+(r.target||0),0);
  const metrics=[
   [t('الأداء العام','Overall performance'),label(mean(scores)),'overall',t('متوسط التقييمات المسجّلة للشهر','Mean of recorded monthly reviews')],
   [t('التسويق وجلب الأعمال','Marketing and new business'),marketing?number(count)+' / '+(hasTarget?number(target):t('لا يوجد هدف محدد','No target configured')):missing(),'marketing',marketing?t('الفرص المفتوحة','Open opportunities')+' '+number(marketing.filter(r=>!['contracted','lost'].includes(r.stage)).length)+' · '+t('الهدف حسب الشركة','Target by company'):missing()],
   [t('أداء الإدارة','Management performance'),label(model.management?.eligible?model.management.onTime/model.management.eligible*10000:null),'management',t('الموافقات المتأخرة','Overdue approvals')+' '+number(model.management?.overdue)+' · '+t('المعاملات المعادة','Returned transactions')+' '+number(model.management?.returned)],
   [t('أداء الموظفين','Employee performance'),label(completed.length?within/completed.length*10000:null),'employees',t('المنجز في الموعد ÷ المنجز بمهلة مسجلة','On-time completions ÷ completions with a deadline')+' · '+t('المهام المتأخرة','Overdue tasks')+' '+number(taskRows(model,'late').length)]
  ];
  const scoresByMetric={overall:mean(scores),marketing:hasTarget&&target>0?count/target*10000:null,management:model.management?.eligible?model.management.onTime/model.management.eligible*10000:null,employees:completed.length?within/completed.length*10000:null};
  const companyStatus='<div class="ab-board-company-status"><span aria-label="'+t('الشركات الخضراء','Green companies')+'">'+number(states.filter(x=>x===true).length)+'</span><span aria-label="'+t('الشركات الحمراء','Red companies')+'">'+number(states.filter(x=>x===false).length)+'</span></div>';
  return '<div class="ab-board-metrics">'+metrics.map(([title,value,id,note])=>{
   const score=scoresByMetric[id],arc=score==null?0:Math.min(10000,Math.max(0,score))*180/10000;
   const gauge='<div class="ab-board-gauge'+(score==null?' is-empty':'')+'" style="--score:'+arc+'deg"><strong>'+e(value)+'</strong></div>';
   return '<article><h3>'+(readOnly?e(title):action(title,id))+'</h3>'+gauge+(id==='overall'?companyStatus:'')+'<small>'+e(note)+'</small></article>';
  }).join('')+'</div>';
 }
 function dashboardModules(model,counts,readOnly=false){
  const overview=model.overview||{},reports=model.layout.sections.reports,charts=model.layout.sections.charts;
  const names=new Set([...model.companies.map(row=>row.id),...(overview.financial||[]).map(row=>row.companyId)]);
  const financial=(overview.financial||[]),byCompany=[...names].flatMap(id=>financial.some(r=>r.companyId===id)?financial.filter(r=>r.companyId===id):[{companyId:id}]);
  const columns=['amount','due','paid','overdue','outstanding'];
  const companyCount=(data,id)=>number(data?(data[id]||0):null);
  const financialHTML=()=>tableView([t('الشركة','Company'),t('الحسابات البنكية','Bank accounts'),t('الموظفون','Employees'),t('إجمالي الفواتير','Invoiced'),t('المستحق للدفع','Due'),t('المحصّل','Collected'),t('المتأخرات','Overdue'),t('إجمالي المتبقي','Outstanding')],[...byCompany.map(r=>[e(companyName(r.companyId)),companyCount(overview.bankCounts,r.companyId),companyCount(overview.employeeCounts,r.companyId),...columns.map(key=>e(money(r[key],r.currency)))]),...(overview.totals||[]).map((r,index)=>[e(t('إجمالي المجموعة','Group total')),index?'—':number(model.counts.banks),index?'—':number(model.counts.employees),...columns.map(key=>e(money(r[key],r.currency)))])]);
  const banks=model.postedFinancial?.banks||[];
  const metricAllowed=charts;
  const bodies={performance:metricAllowed?()=>performance(model,readOnly):null,movement:charts&&model.layout.detailWidgets.includes('vehicles')&&model.counts.vehicles!=null?()=>movementPanel(readOnly?model.previewMovement:movementData,readOnly):null,
   financial:reports&&(model.counts.invoices!=null||overview.bankCounts||overview.employeeCounts)?financialHTML:null,
   debt:reports&&model.counts.invoices!=null?()=>tableView([t('الجهة','Debtor'),t('المستحق','Due')],(overview.debt||[]).map(r=>[e(r.name),e(money(r.amount,r.currency))])):null,
   items:reports&&model.counts.invoices!=null?()=>tableView([t('البند','Item'),t('المستحق','Due')],(overview.items||[]).map(r=>[e(r.name),e(money(r.amount,r.currency))])):null,
   contracts:reports&&overview.marketing?()=>tableView([t('الشركة','Company'),t('العقود','Contracts')],(overview.marketingCompanies||[]).map(r=>[e(companyName(r.companyId)),number(r.contracts?.length)])):null,
   emirates:reports&&overview.companies?()=>{const groups={};for(const r of overview.companies)if(r.emirate)groups[r.emirate]=(groups[r.emirate]||0)+1;return tableView([t('الإمارة','Emirate'),t('الشركات','Companies')],Object.entries(groups).map(([id,n])=>{const area=AreaReference.emirates.find(a=>[a.id,a.ar,a.en,a.legacy].includes(id));return [e(area?t(area.ar,area.en):id),number(n)];}));}:null,
   investors:reports&&overview.investments?()=>tableView([t('الشركة','Company'),t('المستثمرون','Investors'),t('المبلغ المستثمر','Invested amount'),t('المركبات','Vehicles'),t('محصّل الأقساط','Installments collected'),t('محصّل رسوم اللوحات','Plate fees collected'),t('المتبقي من الأصل','Principal remaining')],(overview.investorCompanies||[]).map(r=>[e(companyName(r.companyId)),number(r.investors),e(money(r.invested,r.currency)),number(r.vehicles),e(money(r.installments,r.currency)),e(money(r.plateFees,r.currency)),e(money(r.principal,r.currency))])):null,
   banks:banks.length?()=>readOnly?bankTable(banks,true):action(t('فتح رصد البنوك','Open bank monitoring'),'banks'):null,
   counts:()=>counts,tasks:model.layout.sections.tasks?()=>'<div class="ab-board-filters">'+(readOnly?'':[['today',t('اليوم','Today')],['late',t('متأخرة','Overdue')],['pending',t('بانتظار إجراء','Awaiting action')]].map(([id,label])=>'<button type="button" data-task-filter="'+id+'" aria-pressed="'+(id===taskFilter)+'">'+label+'</button>').join(''))+'</div><div data-board-tasks>'+taskTable(taskRows(model,taskFilter),readOnly)+'</div>'+(!readOnly&&!model.layout.securityConfigured?'<details><summary>'+t('مهامي وقراراتي','My tasks and decisions')+'</summary>'+MyWorkUI.html()+'</details>':''):null};
  const urgent=model.layout.sections.alerts&&(model.panels?.alerts||[]).length?'<aside class="ab-board-urgent"><h2>'+t('يتطلب إجراءً','Requires action')+'</h2>'+taskTable(model.panels.alerts,readOnly)+'</aside>':'';
  return urgent+'<div class="ab-board-grid">'+layoutFor(model).filter(row=>row.visible&&bodies[row.id]).map(row=>'<section class="ab-board-module ab-board-'+row.size+'"><h2>'+moduleTitle(row.id)+'</h2><div>'+bodies[row.id]()+'</div></section>').join('')+'</div>';
 }
 function movementPanel(report,readOnly){
  if(!report?.available)return '<p>'+e((!readOnly&&movementError)||missing())+'</p>';
  const years=[...new Set(report.months.map(row=>row.month.slice(0,4)))].slice(-3).reverse();
  const palette=['#146447','#487a65','#976170'],colors=years.map(year=>palette[(Number(year)%palette.length+palette.length)%palette.length]),scale=Math.max(1,...report.months.flatMap(r=>[r.in,r.out]));
  return '<div class="ab-board-year">'+years.map((year,i)=>'<span style="--year:'+colors[i]+'">'+year+'</span>').join('')+'</div><div class="ab-board-chart">'+Array.from({length:12},(_,i)=>{
   const mm=String(i+1).padStart(2,'0'),label=new Intl.DateTimeFormat(getLocale(),{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2020,i,1)));
   return '<div class="ab-board-month"><div class="ab-board-bars">'+years.map((year,index)=>{
    const row=report.months.find(r=>r.month===year+'-'+mm);
    return '<div style="--year:'+colors[index]+'">'+['in','out'].map(dir=>row?.[dir]?'<button type="button" class="ab-board-bar '+dir+'" style="--height:'+Math.max(15,row[dir]/scale*56)+'px" aria-label="'+e(row.month+' '+(dir==='in'?t('إضافات','Additions'):t('خروج','Exits'))+' '+row[dir])+'" data-board-action="movement:'+row.month+':'+dir+'" '+(readOnly?'disabled':'')+'>'+e(number(row[dir]))+'</button>':'<span class="ab-board-bar '+dir+'"></span>').join('')+'</div>';
   }).join('')+'</div><small>'+e(label)+'</small></div>';
  }).join('')+'</div>';
 }
 const bankLabel=row=>{const bank=(app.state.bankReference||[]).find(b=>b.id===row.bankId);return bank?t(bank.ar,bank.en):row.bankName||row.name;};
 function bankTable(rows,readOnly){
  return tableView([t('الشركة','Company'),t('البنك','Bank'),t('آخر أربعة أرقام','Last four'),t('الرصيد المسجل','Recorded balance'),t('إيداعات قيد التحقق','Deposits in review'),t('المطابقة','Reconciliation'),t('آخر مطابقة','Last reconciliation')],rows.map(r=>[e(companyName(r.companyId)),readOnly?e(bankLabel(r)):action(bankLabel(r),'bank:'+r.id),e(r.lastFour||'—'),e(money(r.balance,r.currency)),((r.deposits||[]).some(item=>item.date<todayDubai())?'<strong class="ab-board-warning">':'<strong>')+e(money(r.pending,r.currency))+'</strong>',r.reconciliation?'<strong class="'+(r.reconciliation==='Approved'&&!r.unmatched?'':'ab-board-warning')+'">'+e(r.unmatched?t('بنود غير مطابقة','Unmatched lines'):r.reconciliation)+'</strong>':'—',e(r.reconciledOn||'—')]));
 }
 function boardActions(host){
  host.addEventListener('click',async event=>{
   const button=event.target.closest('[data-board-action]')||(!event.target.closest('button,input,select,a')&&event.target.closest('tr,.ab-board-metrics article')?.querySelector('[data-board-action]'));if(!button||button.disabled)return;
   button.focus({preventScroll:true});
   const [kind,id,direction]=button.dataset.boardAction.split(':');
   try {
    if(kind==='task'){
     const row=(data.panels?.tasks||[]).find(x=>x.id===id)||(data.panels?.alerts||[]).find(x=>x.id===id);
     if(!row)return;
     const d=overlay(row.title,taskTable([row],true)+'<h3>'+t('سجل المهمة','Task history')+'</h3><p role="status">'+t('جار التحميل','Loading')+'</p>');
     try{const history=await CenterForms.api('personnel/tasks/'+encodeURIComponent(id)+'/history');if(!d.isConnected)return;d.querySelector('[role=status]').outerHTML=tableView([t('الحدث','Event'),t('التاريخ','Date')],(history.rows||[]).map(r=>[e(r.kind||r.action||r.event_type||r.event||'—'),e(String(r.createdAt||r.created_at||'').slice(0,16)||'—')]));}catch{d.querySelector('[role=status]').textContent=missing();}
    }else if(kind==='overall'||kind==='employees'){
     const rows=data.overview.evaluations,ids=[...new Set([...data.companies.map(r=>r.id),...rows.map(r=>r.companyId)])];
     overlay(t('تقييم الشركات','Company evaluations'),tableView([t('الشركة','Company'),t('التقييم','Evaluation')],ids.map(companyId=>{
      const scores=rows.filter(r=>r.companyId===companyId&&r.score!=null),score=scores.length?scores.reduce((sum,r)=>sum+r.score,0)/scores.length:null;
      return [action(companyName(companyId),'company-performance:'+companyId),e(score==null?missing():number(Math.round(score/100))+'%')];
     })));
    }else if(kind==='company-performance'){
     overlay(t('العاملون في ','Employees at ')+companyName(id),tableView([t('الموظف','Employee'),t('الوظيفة','Job'),t('التقييم','Evaluation'),t('المستهدف / المحصّل / المتبقي','Target / collected / remaining')],data.overview.evaluations.filter(r=>r.companyId===id).map(r=>[e(r.name),e(r.jobTitle||'—'),e(r.score==null?missing():number(r.score/100)+'%'),e((r.collections||[]).map(c=>[money(c.target,c.currency),money(c.actual,c.currency),money(c.remaining,c.currency)].join(' / ')).join(' · ')||'—')])));
    }else if(kind==='marketing'){
     overlay(moduleTitle('contracts'),tableView([t('الشركة','Company'),t('مؤكد','Confirmed'),t('الهدف','Target'),t('الفرص المفتوحة','Open opportunities')],(data.overview.marketingCompanies||[]).map(r=>[action(companyName(r.companyId),'marketing-company:'+r.companyId),number(r.contracts.length),r.target==null?t('لا يوجد هدف محدد','No target configured'):number(r.target),number(r.open)])));
    }else if(kind==='marketing-company'){
     const row=data.overview.marketingCompanies.find(r=>r.companyId===id);
     overlay(companyName(id),tableView([t('الفرصة','Opportunity'),t('المرحلة','Stage')],data.overview.marketing.filter(r=>r.companyId===id).map(r=>[e(r.title),e(r.stage)]))+'<h3>'+t('العقود','Contracts')+'</h3>'+tableView([t('العقد','Contract'),t('الحالة','Status')],row.contracts.map(r=>[e(r.title),e(r.state)])));
    }else if(kind==='management')overlay(t('أداء الإدارة','Management performance'),'<p>'+t('المعاملات المنجزة في الموعد ÷ المعاملات المنجزة التي لها مهلة مسجلة.','On-time transactions ÷ completed transactions with a recorded deadline.')+'</p><p>'+e(data.management?.eligible?number(data.management.onTime)+' / '+number(data.management.eligible):missing())+'</p>');
    else if(kind==='movement'){
     const rows=movementData.rows.filter(r=>r.month===id&&r.direction===direction),ids=[...new Set(rows.map(r=>r.companyId))];
     overlay(id+' · '+(direction==='in'?t('إضافات','Additions'):t('خروج','Exits')),'<div class="ab-board-company-chart">'+ids.map(companyId=>'<div style="--height:'+Math.max(18,rows.filter(r=>r.companyId===companyId).length/rows.length*140)+'px">'+action(companyName(companyId)+' · '+number(rows.filter(r=>r.companyId===companyId).length),'movement-company:'+id+':'+direction+':'+companyId)+'</div>').join('')+'</div>');
    }else if(kind==='movement-company'){
     const companyId=button.dataset.boardAction.split(':')[3];
     overlay(companyName(companyId),tableView([t('المركبة','Vehicle'),t('اللوحة','Plate'),t('التاريخ','Date')],movementData.rows.filter(r=>r.month===id&&r.direction===direction&&r.companyId===companyId).map(r=>[e(r.fileNumber),e(r.plate),e(r.date)])));
    }else if(kind==='banks'){
     const rows=data.postedFinancial.banks;
     const filter=(id,label,choices)=>'<label>'+label+'<select data-bank-filter="'+id+'"><option value="">'+t('الكل','All')+'</option>'+choices.map(([key,name])=>'<option value="'+e(key)+'">'+e(name)+'</option>').join('')+'</select></label>';
     const unique=(key,label)=>[...new Map(rows.map(row=>[key(row),label(row)]))];
     const d=overlay(moduleTitle('banks'),'<div class="ab-board-filters">'+filter('companyId',t('الشركة','Company'),unique(r=>r.companyId,r=>companyName(r.companyId)))+filter('bankId',t('البنك','Bank'),unique(r=>r.bankId,bankLabel))+filter('id',t('الحساب','Account'),unique(r=>r.id,r=>r.name))+'</div><div data-bank-table>'+bankTable(rows)+'</div>');
     d.querySelectorAll('select').forEach(sel=>sel.onchange=()=>{const filters=[...d.querySelectorAll('select')];d.querySelector('[data-bank-table]').innerHTML=bankTable(rows.filter(r=>filters.every(f=>!f.value||r[f.dataset.bankFilter]===f.value)));});
    }else if(kind==='bank'){
     const row=data.postedFinancial.banks.find(r=>r.id===id);
     const d=overlay(row.name,bankTable([row],true)+'<p>'+t('آخر كشف مسجّل','Latest recorded statement')+': '+e(row.statementPeriod||'—')+'</p>'+tableView([t('مرجع الإيداع','Deposit reference'),t('تاريخ الإيداع','Deposit date'),t('المبلغ','Amount')],(row.deposits||[]).map(item=>[e(item.reference||item.id),e(item.date),e(money(item.amount,row.currency))]))+'<button type="button" class="ghost-btn" data-bank-original>'+t('فتح ملف الحساب','Open account record')+'</button>');
     d.querySelector('[data-bank-original]').onclick=()=>ABCentral.openBank(id);
     if(row.statementId){
      const b=document.createElement('button');b.type='button';b.className='ghost-btn';b.textContent=t('فتح كشف المطابقة','Open reconciliation statement');
      d.querySelector('.ab-board-dialog-body').append(b);
      b.onclick=async()=>{try{
       const record=await CenterForms.api('finance/statements/'+encodeURIComponent(row.statementId));
       overlay(b.textContent,tableView([t('التاريخ','Date'),t('المرجع','Reference'),t('المبلغ','Amount'),t('المطابقة','Match')],record.lines.map(line=>[e(String(line.effective_on).slice(0,10)),e(line.reference),e(money(line.amount,row.currency)),e(line.entry_id?t('مطابق','Matched'):line.explanation||t('غير مطابق','Unmatched'))])));
      }catch(error){overlay(b.textContent,'<p>'+e(error.message)+'</p>');}};
     }

    }
   }catch(error){overlay(t('تعذر فتح السجل','Could not open record'),'<p>'+e(error.message)+'</p>');}
  });
 }
 function openBoardSettings(){
  const items=layoutFor(data).map(row=>({...row}));
  const d=overlay(t('تخصيص','Customize'),'<div data-board-settings></div><footer><button type="button" data-board-save>'+t('حفظ','Save')+'</button>'+(data.targets?.length?'<button type="button" data-board-preview>'+t('لوحة التحكم المركزية','Central dashboard')+'</button>':'')+'</footer><p role="alert"></p>');
  const host=d.querySelector('[data-board-settings]');
  const refresh=()=>{
   host.innerHTML=items.map((row,i)=>'<div class="ab-board-setting"><label><input type="checkbox" data-visible '+(row.visible?'checked':'')+'> '+moduleTitle(row.id)+'</label><select aria-label="'+t('الحجم','Size')+'">'+[['small',t('صغير','Small')],['medium',t('متوسط','Medium')],['wide',t('كامل','Wide')]].map(([id,name])=>'<option value="'+id+'" '+(row.size===id?'selected':'')+'>'+name+'</option>').join('')+'</select><button type="button" aria-label="'+t('تحريك لأعلى','Move up')+'" '+(i===0?'disabled':'')+'>↑</button><button type="button" aria-label="'+t('تحريك لأسفل','Move down')+'" '+(i===items.length-1?'disabled':'')+'>↓</button></div>').join('');
   [...host.children].forEach((el,i)=>{el.querySelector('input').onchange=ev=>items[i].visible=ev.target.checked;el.querySelector('select').onchange=ev=>items[i].size=ev.target.value;[...el.querySelectorAll('button')].forEach((b,n)=>b.onclick=()=>{const next=i+(n?1:-1);[items[i],items[next]]=[items[next],items[i]];refresh();});});
  };
  refresh();
  d.querySelector('[data-board-save]').onclick=async event=>{
   event.target.disabled=true;
   try{await CenterForms.api('central-dashboard/preferences','POST',{widgets,sections,modules:items},crypto.randomUUID());d.close();await load();}
   catch(error){d.querySelector('[role=alert]').textContent=error.message;event.target.disabled=false;}
  };
  d.querySelector('[data-board-preview]')?.addEventListener('click',openCentralPreview);
 }
 function openCentralPreview(){
  const targets=data.targets.filter(u=>u.previewable!==false&&u.status==='Active');
  const options=(rows)=>rows.map(([id,label])=>'<option value="'+e(id)+'">'+e(label)+'</option>').join('');
  const d=overlay(t('لوحة التحكم المركزية','Central dashboard'),'<p class="ab-board-preview-label">'+t('وضع المعاينة','Preview mode')+'</p><div class="ab-board-filters"><label>'+t('الدور','Role')+'<select data-role>'+options([...new Set(targets.map(u=>u.roleId))].map(id=>[id,getRoleName(id)]))+'</select></label><label>'+t('المستخدم','User')+'<select data-user></select></label><label>'+t('الشركة','Company')+'<select data-company></select></label><label>'+t('الجهاز','Device')+'<select data-device>'+options([['desktop',t('كمبيوتر','Desktop')],['tablet',t('تابلت','Tablet')],['phone',t('هاتف','Phone')]])+'</select></label></div><div class="ab-board-preview" data-preview-board></div>');
  const role=d.querySelector('[data-role]'),user=d.querySelector('[data-user]'),co=d.querySelector('[data-company]'),screen=d.querySelector('[data-preview-board]'),device=d.querySelector('[data-device]');
  let request=0;
  device.onchange=()=>screen.dataset.device=device.value;
  async function refresh(resetCompanies){
   const id=++request;screen.textContent=t('جار التحميل','Loading');
   if(!user.value){screen.textContent=missing();return;}
   const query=new URLSearchParams({asUserId:user.value});if(!resetCompanies&&co.value)query.set('companyId',co.value);
   try {
    const model=await CenterForms.api('central-dashboard?'+query);if(id!==request)return;
    if(resetCompanies)co.innerHTML='<option value="">'+t('الكل','All')+'</option>'+options(model.companies.map(r=>[r.id,companyName(r.id)]));
    if(model.layout.sections.charts&&model.layout.detailWidgets.includes('vehicles')&&model.counts.vehicles!=null){
     try{model.previewMovement=await CenterForms.api('central-dashboard/vehicle-movements?'+query+'&months=36');}catch{model.previewMovement=null;}
    }
    if(id===request)screen.innerHTML=dashboardModules(model,renderCounts(model,true),true);
   }catch{if(id===request)screen.textContent=t('المعاينة غير متاحة لهذا الدور أو النطاق','Preview unavailable for this role or scope');}
  }
  role.onchange=()=>{user.innerHTML=options(targets.filter(u=>u.roleId===role.value).map(u=>[u.id,targetName(u)]));void refresh(true);};
  user.onchange=()=>refresh(true);co.onchange=()=>refresh(false);role.onchange();device.onchange();
 }
 function renderCounts(model,readOnly=false){
  return '<div class="stats-grid">'+Object.entries(model.counts).filter(([key,value])=>model.layout.widgets.includes(key)&&value!==null&&(key!=='tasks'||model.layout.sections.tasks)).map(([key,value])=>'<button type="button" class="stat-card" data-dashboard="source" data-id="'+e(key)+'" '+(readOnly||!model.layout.detailWidgets.includes(key)?'disabled':'')+'><strong class="stat-label">'+e(t(...labels[key]))+'</strong><span class="stat-value">'+e(number(value))+'</span></button>').join('')+'</div>';
 }
 function renderUI(){
  sync();if(!data&&!loading&&!error)void load();
  const select=(id,options,value)=>'<select class="input" id="'+id+'"><option value="">'+t('الكل','All')+'</option>'+options.map(o=>'<option value="'+e(o.id)+'" '+(o.id===value?'selected':'')+'>'+e(o.name)+'</option>').join('')+'</select>';
  return `<section id="central-dashboard" class="ab-board"><p role="alert">${e(error)}</p><div class="ab-board-toolbar"><label>${t('الشركة','Company')}${select('dashboard-company',data?.companies||[],company)}</label><label>${t('من','From')}<input class="input" id="dashboard-from" type="date" value="${e(from)}"></label><label>${t('إلى','To')}<input class="input" id="dashboard-to" type="date" value="${e(to)}"></label><label>${t('الإدارة','Department')}${select('dashboard-department',data?.departments||[],department)}</label><button class="secondary-btn" data-dashboard="refresh">${t('تحديث','Refresh')}</button>${data&&!ABCentral.viewAs?'<button type="button" class="primary-btn" data-dashboard="board-settings">'+t('تخصيص','Customize')+'</button>':''}</div>${loading?'<p role="status">'+t('جار التحميل','Loading')+'</p>':''}${data?dashboardModules(data,renderCounts(data)):''}${data?.targets.length?`<details class="ab-board-legacy"><summary>${t('إدارة تفضيلات العرض للمستخدمين','Manage appearance for users')}</summary>${previewPicker()}<button type="button" data-dashboard="preferences">${t('إعدادات الظهور','Appearance settings')}</button></details>`:''}</section>`;
 }
 function bind(){const host=document.getElementById('central-dashboard');if(!host)return;
 boardActions(host);
 host.querySelectorAll('[data-task-filter]').forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;host.querySelectorAll('[data-task-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));host.querySelector('[data-board-tasks]').innerHTML=taskTable(taskRows(data,taskFilter));});
 MyWorkUI.bind(host);RegisterView.bind(host,render);bindPreview(host);host.querySelector('#dashboard-search')?.addEventListener('submit',ev=>{ev.preventDefault();searches[source]=ev.target.elements.q.value;render();});for(const b of host.querySelectorAll('[data-dashboard-record]')){b.onclick=()=>openRecord(b.dataset.dashboardRecord);const row=b.closest('tr');row.tabIndex=0;row.onclick=ev=>{if(!ev.target.closest('button,a,input,select,summary,details'))b.click();};row.onkeydown=ev=>{if(ev.target===row&&['Enter',' '].includes(ev.key)){ev.preventDefault();b.click();}};}for(const [id,set]of [['dashboard-company',v=>company=v],['dashboard-department',v=>department=v],['dashboard-from',v=>from=v],['dashboard-to',v=>to=v]])host.querySelector('#'+id)?.addEventListener('change',async ev=>{set(ev.target.value);await load();});for(const b of host.querySelectorAll('[data-dashboard]'))b.onclick=async()=>{const a=b.dataset.dashboard;if(a==='preview'||a==='preview-retry'){const target=previewUser||(ABCentral.viewAs?ABCentral.actor.id:'');if(!target)return;b.disabled=true;await ViewAsUI.start(target,{onError:message=>{previewError=message;render();}});return;}if(a==='back'){source='';render();}else if(a==='owner'){asUser='';source='';await load();}else if(a==='source'||a==='shortcut'){source=b.dataset.id;
 try {
  const q=new URLSearchParams({source});for(const [k,v]of Object.entries({companyId:company,departmentId:department,from,to}))if(v)q.set(k,v);
  const result=await CenterForms.api('central-dashboard?'+q);data.sources[source]=result.sources[source];
  const d=overlay(t(...labels[source]),details()),body=d.querySelector('.ab-board-dialog-body');
  const bindDetails=()=>{body.querySelector('[data-dashboard=back]').onclick=()=>d.close();body.querySelector('form').onsubmit=ev=>{ev.preventDefault();searches[source]=ev.target.elements.q.value;body.innerHTML=details();bindDetails();};body.querySelectorAll('[data-dashboard-record]').forEach(el=>el.onclick=()=>openRecord(el.dataset.dashboardRecord));};
  bindDetails();
 }catch(err){overlay(t('تعذر تحميل السجل','Could not load register'),'<p>'+e(err.message)+'</p>');}}else if(a==='refresh')await load();else if(a==='board-settings'){openBoardSettings();}else if(a==='preferences'){await customize();}};}

 async function customize(){
  const options=[{id:'self',name:t('لوحتي','My dashboard')}];if(ABCentral.actor?.roleId==='owner'){const targets=await CenterForms.api('central-dashboard/layout-targets');for(const u of targets.users)options.push({id:'user:'+u.id,name:t('موظف: ','Employee: ')+(getLocale()==='ar'?u.nameAr||u.nameEn:u.nameEn||u.nameAr)+' · '+getRoleName(u.roleId)});for(const r of targets.roles)options.push({id:'role:'+r.id,name:t('دور: ','Role: ')+getRoleName(r.id)});for(const d of targets.departments)options.push({id:'department:'+d.id,name:t('قسم: ','Department: ')+d.name});}
  CenterForms.form(t('تخصيص ظهور لوحة التحكم — لا يغير الصلاحيات','Dashboard appearance — does not change access'),[{name:'target',ar:'الموظف أو الدور أو القسم',en:'Employee, role or department',options}],async d=>{
   const [type,id]=d.target.split(':'),scope=type==='self'?{}:{[type+'Id']:id},current=await CenterForms.api('central-dashboard/preferences?'+new URLSearchParams(scope));
   setTimeout(()=>CenterForms.form(t('العناصر المعروضة','Visible elements'),[...Object.entries(labels).map(([name,label])=>({name,ar:label[0],en:label[1],type:'checkbox',value:current.widgets.includes(name)})),...Object.entries({charts:['الرسوم البيانية','Charts'],reports:['التقارير','Reports'],tasks:['لوحة المهام','Task panel'],alerts:['تنبيهات المهام','Task alerts']}).map(([name,label])=>({name:'section_'+name,ar:label[0],en:label[1],type:'checkbox',value:current.sections?.[name]!==false}))],async(values,key)=>{
    const chosen=Object.keys(labels).filter(k=>values[k]===true),sectionValues=Object.fromEntries(['charts','reports','tasks','alerts'].map(k=>[k,values['section_'+k]===true]).concat([['shortcuts',current.sections?.shortcuts!==false]]));
    if(!confirm(t('تأكيد حفظ إعدادات الظهور للهدف المختار؟ لا تمنح هذه الإعدادات صلاحيات بيانات.','Confirm appearance for the selected target? These settings grant no data access.')))throw Error(t('لم يتم الحفظ','Not saved'));
    await CenterForms.api('central-dashboard/preferences','POST',{widgets:chosen,sections:sectionValues,...scope,...(type==='self'?{}:{confirm:true,version:current.version})},key);await load();
   }),0);
  });
 }
 root.DashboardUI={render:renderUI,bind,invalidate(){epoch++;targetCache=null;data=null;loading=false;error='';}};
})(globalThis);

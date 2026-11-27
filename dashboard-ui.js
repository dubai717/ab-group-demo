(function(root){'use strict';
 const t=(a,b)=>getLocale()==='ar'?a:b,e=v=>CenterForms.esc(v),labels={contractingCompanies:['الشركات المتعاقدة','Contracting companies'],companies:['الشركات','Companies'],banks:['الحسابات البنكية','Bank accounts'],customers:['العملاء','Customers'],vehicles:['المركبات','Vehicles'],invoices:['الفواتير','Invoices'],employees:['الموظفون','Employees'],tasks:['المهام','Tasks'],marketing:['فرص التسويق','Marketing opportunities'],investments:['الاستثمارات','Investments']};
 let movementEpoch=0;let dynamicReport='',movementData=null,movementError='',movementMonths=12,movementEmirate='',movementLicence='',movementFocus=null,userQuery='',previewUser='',previewOpen=false,previewError='';const searches={};
 let countsOpen=false,targetCache=null;let actor='',epoch=0,data=null,error='',loading=false,company='',asUser='',source='',from='',to='',department='',widgets=Object.keys(labels),sections={charts:true,reports:true,tasks:true,shortcuts:true,alerts:true};
 function sync(){if(actor!==ABCentral.actor?.id){actor=ABCentral.actor?.id;targetCache=null;overviewMovements=null;overviewMovementError='';comparisonYears=null;sections={charts:true,reports:true,tasks:true,shortcuts:true,alerts:true};for(const key of Object.keys(searches))delete searches[key];epoch++;data=null;error='';loading=false;company=asUser=source=from=to=department='';widgets=Object.keys(labels);dynamicReport='';movementData=null;movementFocus=null;movementEpoch++;movementEmirate=movementLicence='';userQuery='';previewUser='';previewOpen=false;previewError='';}}
 async function load(){sync();loading=true;error='';overviewMovements=null;overviewMovementError='';const n=++epoch;const host=document.getElementById('central-dashboard');host?.querySelectorAll('button,input,select').forEach(b=>b.disabled=true);const spinner=setTimeout(()=>{if(n===epoch&&loading&&host?.isConnected)host.insertAdjacentHTML('afterbegin',`<p data-dashboard-loading role="status">${t('جارٍ تحميل السجلات المصرح بها…','Loading authorized records…')}</p>`);},180);try{const q=new URLSearchParams();for(const [k,v]of Object.entries({companyId:company,departmentId:department,asUserId:asUser,from,to}))if(v)q.set(k,v);if(source)q.set('source',source);const [result,targets]=await Promise.all([CenterForms.api('central-dashboard?'+q),(targetCache?Promise.resolve({rows:targetCache}):CenterForms.api('view-as/targets').catch(err=>{if(err.status===403||err.message==='denied')return {rows:[]};throw err;})),!asUser?MyWorkUI.load({companyId:company,departmentId:department}):null]);if(n!==epoch)return;if(targets){targetCache=targets.rows;result.targets=targets.rows;}data=result;widgets=result.layout.widgets;sections=result.layout.sections||{charts:true,reports:true,tasks:true,shortcuts:true,alerts:true};movementRequest(result);}catch(err){if(n===epoch){error=t('تعذر تحميل لوحة التحكم. أعد المحاولة؛ لم تُعرض أعداد بديلة. ','Cannot load dashboard. Retry; no replacement counts were shown. ')+err.message;data=null;}}finally{clearTimeout(spinner);if(n===epoch){loading=false;if(app.state.currentPage==='dashboard')render();}}}
 const columnNames={nameAr:['الاسم بالعربية','Arabic name'],nameEn:['الاسم بالإنجليزية','English name'],companyName:['الشركة','Company'],tradeLicenseNumber:['رقم الرخصة','License number'],emirate:['الإمارة','Emirate'],status:['الحالة','Status'],number:['رقم الملف','File number'],name:['الاسم','Name'],accountName:['اسم الحساب','Account name'],bankName:['البنك','Bank'],currency:['العملة','Currency'],nationality:['الجنسية','Nationality'],type:['النوع','Type'],plate:['رقم اللوحة','Plate'],customerName:['العميل','Customer'],kind:['النوع','Kind'],dueOn:['تاريخ الاستحقاق','Due date'],amount:['المبلغ','Amount'],paid:['المحصل','Paid'],outstanding:['المتبقي','Outstanding'],title:['العنوان','Title'],jobTitle:['الوظيفة','Job title'],hiredOn:['تاريخ التعيين','Hire date'],stage:['المرحلة','Stage'],mode:['نوع الاستثمار','Investment type'],licenseNumber:['رقم الرخصة','License number'],relationship:['العلاقة التعاقدية','Relationship']};
 const fields={companies:['nameAr','nameEn','tradeLicenseNumber','emirate','status'],contractingCompanies:['nameAr','nameEn','licenseNumber','relationship','status'],banks:['companyName','bankName','accountName','currency','status'],customers:['number','name','nationality','companyName','status'],vehicles:['number','plate','type','customerName','companyName','status'],invoices:['number','companyName','dueOn','currency','amount','paid','outstanding','status'],employees:['number','name','jobTitle','companyName','hiredOn','status'],tasks:['number','title','companyName','dueOn','status'],marketing:['title','companyName','stage'],investments:['companyName','mode','currency','status']};
 function companyName(id){const co=(app.state.companies||[]).find(c=>c.id===id);return co?(getLocale()==='ar'?co.arabicName:co.englishName)||co.arabicName||co.englishName:t('شركة ضمن الصلاحيات','Authorized company');}
 function bankDialog(title,content,onOpen){
  const trigger=document.activeElement,parent=trigger?.closest('dialog[open]');
  const dialog=document.createElement('dialog');
  dialog.className='record-form-dialog dashboard-bank-dialog';
  dialog.dataset.centerOwned='1';
  dialog.innerHTML=`<div class="section-head"><h2>${e(title)}</h2><button type="button" class="secondary-btn" data-bank-close aria-label="${e(t('إغلاق','Close'))}">×</button></div>${content}`;
  if(parent)parent.hidden=true;
  const close=()=>dialog.close();
  dialog.querySelector('[data-bank-close]').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{
   dialog.remove();
   if(parent?.isConnected)parent.hidden=false;
   if(trigger?.isConnected)trigger.focus();
  },{once:true});
  document.body.append(dialog);
  FloatingRecords.open(dialog,{close});
  onOpen?.(dialog);
 }
 async function openBankDeposits(accountId){
  const snapshot=data;
  const bank=snapshot?.postedFinancial?.banks.find(row=>row.id===accountId&&row.canViewDeposits);
  if(!bank)return;
  const path='central-dashboard/banks/'+encodeURIComponent(bank.id)+'/deposits';
  const {rows,hasMore}=await CenterForms.api(path);
  if(snapshot!==data||app.state.currentPage!=='dashboard')return;
  const heading=t('الإيداعات قيد التحقق','Deposits pending verification');
  const table=rows.length?`<div class="dashboard-compact-scroll"><table><thead><tr><th>${t('التاريخ','Date')}</th><th>${t('المبلغ','Amount')}</th><th>${t('تفاصيل','Details')}</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${e(row.effective_on)}</td><td>${e(formatAmount(row.amount))} ${e(row.currency)}</td><td><button type="button" class="secondary-btn" data-deposit="${e(row.id)}">${t('فتح الإيداع','Open deposit')}</button></td></tr>`).join('')}</tbody></table></div>`:`<p>${t('لا توجد إيداعات قيد التحقق','No deposits pending verification')}</p>`;
  bankDialog(heading+' · '+bank.name,table+(hasMore?`<p>${t('تُعرض أحدث 100 نتيجة. بقية الإيداعات في سجل المالية.','Showing the latest 100 results. See the finance register for more.')}</p>`:''),dialog=>{
   for(const button of dialog.querySelectorAll('[data-deposit]'))button.onclick=async()=>{
    try{
     const {detail}=await CenterForms.api(path+'?depositId='+encodeURIComponent(button.dataset.deposit));
     if(!dialog.isConnected)return;
     bankDialog(t('تفاصيل الإيداع','Deposit details'),`<dl><dt>${t('المرجع','Reference')}</dt><dd>${e(detail.reference||'—')}</dd><dt>${t('تاريخ الإيداع','Deposit date')}</dt><dd>${e(detail.effective_on)}</dd><dt>${t('المبلغ','Amount')}</dt><dd>${e(formatAmount(detail.amount))} ${e(detail.currency)}</dd><dt>${t('الحالة','Status')}</dt><dd>${e(heading)}</dd></dl>`);
    }catch{alert(t('تعذر فتح الإيداع أو تغيّرت حالته.','The deposit could not be opened or its status changed.'));}
   };
  });
 }
 const formatAmount=value=>new Intl.NumberFormat(getLocale()==='ar'?'ar-AE':'en-AE',{minimumFractionDigits:2,maximumFractionDigits:3}).format(value);
 const textValue=value=>value===null||value===undefined?'—':String(value);
 const statusEmpty=()=>t('لا توجد سجلات ضمن النطاق','No records in scope');
 const noMeasure=()=>t('لا توجد بيانات كافية لحساب النسبة','Insufficient data to calculate a rate');
 const panel=(title,content,kind='')=>`<section class="dashboard-panel ${kind}"><h3>${e(title)}</h3><div class="dashboard-panel-body">${content}</div></section>`;
 function overviewTable(headers,rows,footer=[]){
  return `<div class="dashboard-compact-scroll" tabindex="0"><table><thead><tr>${headers.map(label=>`<th scope="col">${e(label)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(value=>`<td>${value}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">${statusEmpty()}</td></tr>`}</tbody>${footer.length?`<tfoot>${footer.map(row=>`<tr>${row.map(value=>`<td>${value}</td>`).join('')}</tr>`).join('')}</tfoot>`:''}</table></div>`;
 }
 const moneyCell=(amount,currency)=>e(formatAmount(amount)+(currency?' '+currency:''));
 const moneyUnits=value=>{const parts=String(value).split('.');return BigInt(parts[0])*1000n+BigInt((parts[0].startsWith('-')?'-':'')+(parts[1]||'').padEnd(3,'0'));};
 function monetaryTotals(rows,counts,amounts,distinctCounts){
  const totals=new Map(),totalCounts=counts.map(field=>distinctCounts?.[field]??(rows.some(row=>row[field]!==null)?rows.reduce((sum,row)=>sum+(row[field]||0),0):null));
  for(const row of rows){
   if(!row.currency)continue;
   const sums=totals.get(row.currency)||amounts.map(()=>0n);
   amounts.forEach((field,i)=>{sums[i]+=moneyUnits(row[field]);});
   totals.set(row.currency,sums);
  }
  if(!totals.size)totals.set(null,amounts.map(()=>0n));
  const amountFromUnits=value=>{const absolute=value<0n?-value:value;return (value<0n?'-':'')+String(absolute/1000n)+'.'+String(absolute%1000n).padStart(3,'0');};
  return [...totals].map(([currency,values],i)=>[e(t('إجمالي النطاق','Scope total')),
   ...(i===0?totalCounts.map(v=>e(textValue(rows.length?v:0))):counts.map(()=>e('—'))),
   ...values.map(value=>moneyCell(amountFromUnits(value),currency))]);
 }
 function financialOverview(){
  const rows=data?.overview?.financial;
  if(!Array.isArray(rows))return '';
  const counts=['banks','employees'],amounts=['invoiced','due','collected','overdue','outstanding'];
  return panel(t('الملخص المالي حسب الشركة','Financial summary by company'),overviewTable(
   [t('الشركة','Company'),t('الحسابات البنكية','Bank accounts'),t('الموظفون','Employees'),t('إجمالي الفواتير','Total invoiced'),t('المستحق للدفع','Due for payment'),t('المحصّل','Collected'),t('المتأخرات','Overdue'),t('إجمالي المتبقي','Total outstanding')],
   rows.map(row=>[e(companyName(row.companyId)),...counts.map(field=>e(textValue(row[field]))),...amounts.map(field=>moneyCell(row[field],row.currency))]),
   monetaryTotals(rows,counts,amounts)));
 }
 function supportingSummaries(){
  const overview=data?.overview;
  if(!overview)return '';
  const cards=[];
  if(data.ageing)for(const [title,rows] of [
   [t('أعلى الجهات مديونية','Highest outstanding by party'),data.ageing.debtors],
   [t('أعلى البنود المستحقة','Highest outstanding by item'),data.ageing.items]
  ])cards.push(panel(title,overviewTable([t('الاسم','Name'),t('المستحق','Outstanding')],rows.map(row=>[
    e((getLocale()==='ar'?row.nameAr:row.nameEn)||row.nameAr||row.nameEn),moneyCell(row.amount,row.currency)
   ]), rows.length?[]:[[e(t('الإجمالي الظاهر','Total shown')),moneyCell('0',null)]])));
  if(Array.isArray(overview.contracts))cards.push(panel(t('العقود حسب الشركة','Contracts by company'),overviewTable(
   [t('الشركة','Company'),t('العقود','Contracts')],overview.contracts.map(row=>[e(companyName(row.companyId)),row.count]),
   [[e(t('الإجمالي','Total')),overview.contracts.reduce((a,row)=>a+row.count,0)]])));
  if(Array.isArray(overview.emirates))cards.push(panel(t('الشركات حسب الإمارة','Companies by emirate'),overviewTable(
   [t('الإمارة','Emirate'),t('الشركات','Companies')],overview.emirates.map(row=>{const entry=AreaReference.emirates.find(x=>[x.id,x.ar,x.en,x.legacy].includes(row.emirate));return [e(entry?t(entry.ar,entry.en):row.emirate),row.count];}),
   [[e(t('الإجمالي المسجّل حسب الإمارة','Total with recorded emirate')),overview.emirates.reduce((a,row)=>a+row.count,0)]])));
  return cards.length?`<div class="dashboard-debt-lists">${cards.join('')}</div>`:'';
 }
 function investorsOverview(){
  const rows=data?.overview?.investors;
  if(!Array.isArray(rows))return '';
  const counts=['investors','vehicles'],amounts=['invested','installments','plates','principal'];
  return panel(t('ملخص المستثمرين حسب الشركة','Investor summary by company'),overviewTable(
   [t('الشركة','Company'),t('المستثمرون','Investors'),t('المركبات','Vehicles'),t('المبلغ المستثمر','Capital received'),t('محصّل الأقساط','Installments collected'),t('محصّل رسوم اللوحات','Plate fees collected'),t('المتبقي من الأصل','Remaining principal')],
   rows.map(row=>[e(companyName(row.companyId)),...counts.map(field=>row[field]),...amounts.map(field=>moneyCell(row[field],row.currency))]),
   monetaryTotals(rows,counts,amounts,data.overview.investorTotals)));
 }
 const metricNames={
  collection:['الأداء العام','Overall performance'],marketing:['التسويق وجلب الأعمال','Marketing and new business'],
  management:['أداء الإدارة','Management performance'],staff:['أداء الموظفين','Employee performance']
 };
 const completion=(done,due)=>due?Math.round(done*100/due):null;
 function score(row,key){
  if(key==='collection')return row.collection;
  if(key==='marketing')return row.target>0&&row.opportunities!==null?Math.round(100*row.opportunities/row.target):null;
  return completion(row.done,row.due);
 }
 function performanceOverview(){
  const report=data?.overview?.performance;
  if(!report)return '';
  const taskAmount=(rows,key)=>rows.reduce((total,row)=>total+row[key],0);
  const entries=[];
  if(report.collectionReady){
   const measured=report.rows.map(r=>r.collection).filter(x=>x!==null);
   const target=90;
   const green=measured.filter(x=>x>=target).length;
   entries.push(['collection',measured.length?Math.round(measured.reduce((a,b)=>a+b,0)/measured.length):null,
    `<span class="dashboard-badge-green" aria-label="${t('شركات عند الهدف','Companies at target')}">${green}</span> <span class="dashboard-badge-red" aria-label="${t('شركات دون الهدف','Companies below target')}">${measured.length-green}</span> <small>${t('هدف التحصيل','Collection target')} ${target}%</small>`,report.drilldowns.collection]);
  }
  if(report.marketingReady){
   const measured=report.rows.filter(row=>row.target>0&&row.opportunities!==null);
   entries.push(['marketing',measured.length?completion(taskAmount(measured,'opportunities'),taskAmount(measured,'target')):null,
    `${t('فرص مسجّلة','Recorded opportunities')} ${taskAmount(report.rows,'opportunities')}`,report.drilldowns.marketing]);
  }
  if(report.managementReady)entries.push(['management',completion(taskAmount(report.rows,'done'),taskAmount(report.rows,'due')),
   `${t('مهام متأخرة','Overdue tasks')} ${taskAmount(report.rows,'overdue')}`,report.drilldowns.management]);
  if(report.staffReady)entries.push(['staff',completion(taskAmount(report.staff,'done'),taskAmount(report.staff,'due')),
   `${t('مهام مكتملة','Completed tasks')} ${taskAmount(report.staff,'done')}`,true]);
  return entries.length?panel(t('الأداء','Performance'),`<p class="dashboard-metric-period">${e(report.specialPeriod?t('حسب الفترة المختارة','Selected period'):t('الشهر','Month')+' '+report.month)}</p><div class="dashboard-gauges">${entries.map(([key,value,caption,clickable])=>`<div class="dashboard-gauge">
   <h4>${clickable?`<button type="button" class="secondary-btn" data-overview-metric="${key}">${t(...metricNames[key])}</button>`:e(t(...metricNames[key]))}</h4>
   <div class="dashboard-gauge-arc" style="--progress:${Math.min(100,Math.max(0,value||0))*1.8}deg"><strong>${value===null?'—':e(value)+'%'}</strong></div>
   ${value===null?`<small>${noMeasure()}</small>`:''}<div>${caption}</div>
  </div>`).join('')}</div>`):'';
 }
 function openPerformance(key){
  const report=data.overview.performance;
  const title=t(...metricNames[key]);
  const headers=[t('الشركة','Company'),t('الأداء','Performance'),t('التفاصيل','Details')];
  const rows=report.rows.map(row=>{
   const value=score(row,key);
   const canStaff=report.staffReady&&report.staff.some(staff=>staff.companyId===row.companyId)&&(key==='collection'||key==='staff'||key==='management');
   const extra=key==='marketing'?e(t('الفرص','Opportunities')+' '+textValue(row.opportunities)+' / '+textValue(row.target)):
    canStaff?`<button type="button" class="secondary-btn" data-overview-staff="${e(row.companyId)}">${key==='collection'?t('عرض المحصّلين','View collectors'):t('عرض الموظفين','View employees')}</button>`:'—';
   return [e(companyName(row.companyId)),value===null?'—':e(value)+'%',extra];
  });
  bankDialog(title,overviewTable(headers,rows),dialog=>{
   for(const b of dialog.querySelectorAll('[data-overview-staff]'))b.onclick=()=>{
    const staff=report.staff.filter(row=>row.companyId===b.dataset.overviewStaff&&(key!=='collection'||row.collections.due>0));
    bankDialog(companyName(b.dataset.overviewStaff),overviewTable(
     [t('الموظف','Employee'),t('المكتملة','Completed'),t('المستحقة','Due'),key==='collection'?t('إنجاز مهام التحصيل','Collection task completion'):t('نسبة الإنجاز','Completion rate')],
     staff.map(row=>{const metrics=key==='collection'?row.collections:row;const rate=score(metrics,'staff');return [e(row.name),metrics.done,metrics.due,rate===null?'—':e(rate)+'%'];})));
   };
  });
 }
 function urgentOverview(){
  const rows=data?.overview?.urgent;
  return Array.isArray(rows)?panel(t('يتطلب إجراءً','Action required'),overviewTable(
   [t('المهمة','Task'),t('الشركة','Company'),t('المسؤول','Assignee'),t('الاستحقاق','Due'),t('الحالة','Status')],
   rows.map(row=>[data.layout.detailWidgets.includes('tasks')?`<button type="button" class="secondary-btn" data-overview-task="${e(row.id)}">${e(row.title)}</button>`:e(row.title),
    e(companyName(row.companyId)),e(textValue(row.employee)),e(row.dueOn),e(row.status)]), rows.length?[]:[[e(t('مهام تتطلب إجراءً','Tasks requiring action')),0,'—','—','—']]),'dashboard-urgent'):'';
 }
 function bankOverview(){
  const rows=data?.postedFinancial?.banks;
  if(!sections.reports||department||!Array.isArray(rows)||(!rows.length&&data?.counts.banks===null))return '';
  const table=rows.length?CenterForms.table('dashboard-banks:'+actor,data.postedFinancial.banks,[['name',t('الحساب','Account')],['currency',t('العملة','Currency')],['balance',t('الرصيد','Balance')],['status',t('الحالة','Status')]],'',row=>row.canViewDeposits?`<button type="button" class="secondary-btn" data-bank-deposits="${e(row.id)}">${t('الإيداعات قيد التحقق','Pending deposits')}</button>`:'',{balance:'number'}):overviewTable([t('الحساب','Account'),t('الرصيد','Balance')],[],[[e(t('إجمالي الحسابات المعروضة','Displayed accounts')),0]]);
  return panel(t('رصد البنوك','Bank monitoring'),table);
 }
 let overviewMovements=null,overviewMovementError='',comparisonYears=null;
 const monthLabel=(month,style='short')=>new Intl.DateTimeFormat(getLocale()==='ar'?'ar-AE':'en-AE',{month:style,timeZone:'UTC'}).format(new Date(Date.UTC(2020,month-1,1)));
 function movementRequest(result){
  if(!sections.charts||department||result.counts.vehicles===null||!result.layout.detailWidgets.includes('vehicles'))return;
  const current=epoch,params=new URLSearchParams({months:'36'});
  if(company)params.set('companyId',company);
  if(from)params.set('from',from);
  if(to)params.set('to',to);
  CenterForms.api('central-dashboard/vehicle-movements?'+params).then(series=>{
   if(current!==epoch||data!==result)return;
   overviewMovements=series;
   if(app.state.currentPage==='dashboard')render();
  }).catch(()=>{
   if(current!==epoch||data!==result)return;
   overviewMovementError=t('تعذر تحميل حركة المركبات','Unable to load vehicle movements');
   if(app.state.currentPage==='dashboard')render();
  });
 }
 function movementOverview(){
  if(!data||!sections.charts||department||data.counts.vehicles===null||!data.layout.detailWidgets.includes('vehicles'))return '';
  const title=t('حركة المركبات الشهرية','Monthly vehicle movements');
  if(!overviewMovements?.available)return panel(title,`<p role="status">${e(overviewMovementError||(overviewMovements?t('مصدر حركة المركبات غير متاح','Vehicle movement source unavailable'):t('جارٍ تحميل الحركة','Loading movements')))}</p>`);
  const series=overviewMovements.months,latest=Number(series.at(-1).month.slice(0,4));
  const years=Array.from({length:3},(_,index)=>latest-index);
  const selected=comparisonYears?.filter(year=>years.includes(year))||years;
  const active=selected.length?selected:[latest];
  const byMonth=new Map(series.map(row=>[row.month,row]));
  const peak=Math.max(1,...series.filter(row=>active.includes(Number(row.month.slice(0,4)))).flatMap(row=>[row.in,row.out]));
  return panel(title,`<div class="dashboard-movement-years">${years.map((year,index)=>`<button type="button" class="secondary-btn dashboard-year-${index}" data-overview-year="${year}" aria-pressed="${active.includes(year)}">${year}</button>`).join('')}
   <small>${t('الإضافات أعلى الخط والخروج أسفله','Entries above the line, exits below')}</small></div>
   <div class="dashboard-movement-scroll"><div class="dashboard-movement-chart">${Array.from({length:12},(_,index)=>{
    const month=index+1;
    const groups=active.map(year=>{
     const key=year+'-'+String(month).padStart(2,'0'),row=byMonth.get(key);
     if(!row)return '<div class="dashboard-movement-empty" aria-hidden="true"></div>';
     return `<button type="button" class="dashboard-movement-column dashboard-year-${years.indexOf(year)}" data-overview-month="${key}"
      aria-label="${e(monthLabel(month,'long')+' '+year+' · '+t('الإضافات','Entries')+' '+row.in+' · '+t('الخروج','Exits')+' '+row.out)}">
      <span class="dashboard-movement-in"><b style="--bar-size:${Math.max(13,row.in/peak*67)}px">${row.in}</b></span>
      <span class="dashboard-movement-out"><b style="--bar-size:${Math.max(13,row.out/peak*67)}px">${row.out}</b></span></button>`;
    }).join('');
    return `<div class="dashboard-movement-month"><div>${groups}</div><small>${e(monthLabel(month))}</small></div>`;
   }).join('')}</div></div>`);
 }
 function openMovementMonth(month){
  const rows=overviewMovements.rows.filter(row=>row.month===month);
  const companies=Map.groupBy(rows,row=>row.companyId);
  bankDialog(t('حركة المركبات حسب الشركة','Vehicle movements by company')+' · '+month,overviewTable(
   [t('الشركة','Company'),t('الإضافات','Entries'),t('الخروج','Exits'),t('السجلات','Records')],
   [...companies].map(([id,vehicles])=>[e(companyName(id)),vehicles.filter(row=>row.direction==='in').length,vehicles.filter(row=>row.direction==='out').length,
    `<button type="button" class="secondary-btn" data-overview-movement-company="${e(id)}">${t('عرض السجلات','View records')}</button>`]),
   rows.length?[]:[[e(t('الإجمالي','Total')),0,0,'—']]),dialog=>{
   for(const b of dialog.querySelectorAll('[data-overview-movement-company]'))b.onclick=()=>{
    const id=b.dataset.overviewMovementCompany;
    bankDialog(companyName(id)+' · '+month,overviewTable(
     [t('ملف المركبة','Vehicle file'),t('اللوحة','Plate'),t('الحركة','Movement'),t('التاريخ','Date')],
     companies.get(id).map(row=>[e(row.fileNumber),e(row.plate),e(row.direction==='in'?t('دخول','Entry'):t('خروج','Exit')),e(row.date)])));
   };
  });
 }
 function currentOverview(){
  if(!data)return '';
  const keys=['companies','customers','vehicles','invoices','tasks'];
  const cards=keys.filter(key=>widgets.includes(key)&&data.counts[key]!==null&&(key!=='tasks'||sections.tasks));
  return cards.length?panel(t('الوضع الحالي','Current status'),`<div class="dashboard-current">${cards.map(key=>`<div><span>${e(t(...labels[key]))}</span><strong>${data.counts[key]}</strong></div>`).join('')}</div>`):'';
 }
 function records(){return(data?.sources[source]||[]).map(row=>{const co=(app.state.companies||[]).find(c=>c.id===row.companyId),bank=source==='banks'?(app.state.bankReference||[]).find(b=>b.id===row.bankId):null;return{...row,companyName:row.companyName||(co?(getLocale()==='ar'?co.arabicName:co.englishName)||co.arabicName||co.englishName:''),...(source==='companies'?{tradeLicenseNumber:co?.tradeLicenseNumber||''}:{}),...(bank?{bankName:getLocale()==='ar'?bank.ar:bank.en}:{})};});}
 function details(){const columns=(fields[source]||[]).map(k=>[k,t(...columnNames[k])]);return `<section class="dashboard-details"><div class="section-head"><h3>${e(t(...labels[source]))}</h3><button class="secondary-btn" type="button" data-dashboard="back">${t('العودة إلى لوحة التحكم','Back to dashboard')}</button></div><form class="register-search" id="dashboard-search"><input class="input" type="search" name="q" value="${e(searches[source]||'')}" aria-label="${t('البحث المركزي','Central search')}"><button class="ghost-btn" type="submit">${t('بحث','Search')}</button></form>${CenterForms.table('dashboard-source:'+actor+':'+asUser+':'+source,records(),columns,searches[source]||'',r=>`<button type="button" class="ghost-btn" data-dashboard-record="${e(r.id)}">${t('فتح الملف','Open profile')}</button>`,{amount:'number',paid:'number',outstanding:'number',dueOn:'date',hiredOn:'date'})}</section>`;}
 async function openRecord(id){if(!await WorkspaceUI.leave())return;const row=records().find(r=>r.id===id);if(!row)throw Error('notFound');if(source==='companies')return ABCentral.openCompany(id);if(source==='customers')return CustomerUI.open(id);if(source==='vehicles')return VehicleUI.openNotification(id);if(source==='contractingCompanies'){app.state.currentPage='contractingCompanies';return ContractingCompaniesUI.open(id);}const columns=(fields[source]||[]).map(k=>[k,t(...columnNames[k])]);const types={banks:'bankAccounts',employees:'personnel',tasks:'personnel',invoices:'financialManagement',marketing:'marketing',investments:'investors'};const dialog=document.createElement('dialog');dialog.className='record-form-dialog';dialog.dataset.centerOwned='1';dialog.innerHTML=`<h2>${e(t(...labels[source]))}</h2><p>${t('عرض للقراءة فقط','Read-only')}</p><dl>${columns.map(([key,label])=>`<dt>${e(label)}</dt><dd>${e(row[key]??'—')}</dd>`).join('')}</dl><button class="secondary-btn" type="button" data-original>${t('فتح الملف في القسم الأصلي','Open profile in original module')}</button><button class="ghost-btn" type="button" data-close>${t('إغلاق','Close')}</button>`;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.remove();dialog.addEventListener('close',()=>dialog.remove(),{once:true});const requestedSource=source;dialog.querySelector('[data-original]').onclick=async()=>{try{if(requestedSource==='banks')await ABCentral.openBank(id);else if(requestedSource==='employees')await PersonnelUI.openProfile(id);else if(requestedSource==='investments')await InvestorUI.open(id);else await RecordLinks.open(({tasks:'task',invoices:'invoice',marketing:'marketing'})[requestedSource],id);dialog.remove();}catch(err){alert(err.message);}};FloatingRecords.open(dialog);}
 async function loadMovements(){const n=++movementEpoch;movementError='';movementData=null;try{const q=new URLSearchParams({months:String(movementMonths)});for(const[k,v]of Object.entries({companyId:company,licenseId:movementLicence,emirate:movementEmirate,from,to}))if(v)q.set(k,v);const result=await CenterForms.api('central-dashboard/vehicle-movements?'+q);if(n===movementEpoch)movementData=result;}catch(err){if(n===movementEpoch)movementError=err.message;}if(n===movementEpoch&&app.state.currentPage==='dashboard')render();}
 function dynamicHTML(){const options=[['',t('اختر تقريراً','Choose report')],['movement',t('دخول وخروج المركبات','Vehicle entries and exits')],...Object.entries(labels).map(([k,v])=>[k,t(...v)])].filter(([id])=>id===''||(id==='movement'?sections.charts&&data?.counts.vehicles!==null&&(!data?.layout?.detailWidgets||data.layout.detailWidgets.includes('vehicles')):widgets.includes(id)&&(!data?.layout?.detailWidgets||data.layout.detailWidgets.includes(id))&&data?.counts[id]!==null&&(id!=='tasks'||sections.tasks)));let chart='';if(dynamicReport==='movement'&&sections.charts){const r=movementData,largest=Math.max(1,...(r?.months||[]).flatMap(m=>[m.in,m.out]));chart=`<div class="register-actions"><label>${t('الفترة','Period')}<select id="movement-months" class="input"><option value="12" ${movementMonths===12?'selected':''}>12</option><option value="24" ${movementMonths===24?'selected':''}>24</option></select></label><label>${t('الإمارة','Emirate')}<select id="movement-emirate" class="input"><option value="">${t('الكل','All')}</option>${AreaReference.emirates.map(a=>`<option value="${e(a.id)}" ${movementEmirate===a.id?'selected':''}>${e(getLocale()==='ar'?a.ar:a.en)}</option>`).join('')}</select></label><label>${t('الرخصة الحالية','Current licence')}<select id="movement-licence" class="input"><option value="">${t('الكل','All')}</option>${(data?.companies||[]).map(co=>{const c=app.state.companies.find(c=>c.id===co.id);return c?.licenseId?`<option value="${e(c.licenseId)}" ${movementLicence===c.licenseId?'selected':''}>${e(co.name)} — ${e(c.tradeLicenseNumber||'')}</option>`:'';}).join('')}</select></label><button type="button" data-dashboard="movement-refresh">${t('تحديث الرسم','Refresh chart')}</button></div><p role="alert">${e(movementError)}</p>${r?.available===false?`<p>${t('مصدر أحداث المركبات غير جاهز. بقية التقارير متاحة.','Vehicle event source unavailable; other reports remain available.')}</p>`:r?`<p>${t('إجمالي الدخول','Entries')}: ${r.entered} · ${t('إجمالي الخروج','Exits')}: ${r.exited} · ${t('صافي الحركة','Net movement')}: ${r.net}</p><p>${t('الأخضر: تسجيل أو عودة إلى نشط؛ الأحمر: مغادرة نشط أو إغلاق بيع. التاريخ هو تاريخ السريان المسجل، وإلا وقت الحدث. الرخصة والإمارة حسب التسجيل الحالي.','Green: registration/reactivation; red: leaving Active or closing a sale. Recorded effective dates are used, otherwise event timestamps. Licence and emirate use current records.')}</p><div class="movement-chart" role="group" aria-label="${t('الحركة الشهرية للمركبات','Monthly vehicle movements')}">${r.months.map(m=>`<div class="movement-month"><div class="movement-bars">${['in','out'].map(d=>`<button type="button" class="movement-bar movement-${d}" data-movement="${d}" data-month="${m.month}" ${m[d]?'':'disabled'} style="--bar-height:${Math.max(3,m[d]/largest*150)}px" aria-label="${e(m.month+' '+(d==='in'?t('دخول','Entries'):t('خروج','Exits'))+' '+m[d])}"><span>${m[d]}</span></button>`).join('')}</div><small>${m.month}</small></div>`).join('')}</div>${movementFocus?CenterForms.table('movement:'+actor,r.rows.filter(x=>x.month===movementFocus.month&&x.direction===movementFocus.direction),[['fileNumber',t('رقم المركبة','Vehicle file')],['plate',t('اللوحة','Plate')],['date',t('التاريخ','Date')]],'',x=>`<button type="button" data-movement-vehicle="${e(x.vehicleId)}">${t('ملف المركبة','Vehicle profile')}</button>`,{date:'date'}):''}`:`<p>${t('جارٍ تحميل الأحداث الفعلية…','Loading recorded events…')}</p>`}`;}
 return `<section class="dashboard-dynamic record-section"><h3>${t('التقارير الديناميكية','Dynamic reports')}</h3><select id="dashboard-report" class="input">${options.map(([id,name])=>`<option value="${id}" ${dynamicReport===id?'selected':''}>${e(name)}</option>`).join('')}</select>${chart}</section>`;}
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
 function renderUI(){sync();if(!data&&!loading&&!error)void load();const select=(id,options,value)=>`<select class="input" id="${id}"><option value="">${t('الكل','All')}</option>${options.map(o=>`<option value="${e(o.id)}" ${o.id===value?'selected':''} ${o.disabled?'disabled':''}>${e(o.name)}</option>`).join('')}</select>`;
 return `<section class="content-panel" id="central-dashboard"><h2>${t('لوحة التحكم المركزية','Central dashboard')}</h2><p role="alert">${e(error)}</p>${data?.viewAs?`<aside class="view-as-banner" role="status">${t('معاينة قراءة فقط للوحة والتقارير باسم','Read-only dashboard projection for')} ${e(data.actor.name)} · ${e(data.actor.roleId)} <button type="button" data-dashboard="owner">${t('العودة للمالك','Return to owner')}</button><p>${t('لا تتغير هوية حسابك أو صلاحيات أي مستخدم. فتح الوحدات الأصلية يتم بوضع المالك.','Your identity and all grants are unchanged. Original modules open in owner mode.')}</p></aside>`:''}<div class="register-search-row"><label>${t('الشركة','Company')}${select('dashboard-company',data?.companies||[],company)}</label><label>${t('من','From')}<input class="input" id="dashboard-from" type="date" value="${e(from)}"></label><label>${t('إلى','To')}<input class="input" id="dashboard-to" type="date" value="${e(to)}"></label><label>${t('الإدارة (عند توفر ربط مباشر)','Department (direct attribution only)')}${select('dashboard-department',data?.departments||[],department)}</label>${data?.targets?.length?previewPicker():''}${ABCentral.actor?.roleId==='owner'&&!ABCentral.viewAs&&data?.targets?.length?`<button type="button" class="secondary-btn" data-dashboard="preview-grants">${t('صلاحية عرض شاشة المستخدم','User-screen preview access')}</button>`:''}<button type="button" class="secondary-btn" data-dashboard="refresh">${t('تحديث','Refresh')}</button>${!asUser?`<button type="button" class="secondary-btn" data-dashboard="preferences">${t('تخصيص المؤشرات','Choose widgets')}</button>`:''}</div>${loading?`<p role="status">${t('جار التحميل','Loading')}</p>`:''}<p>${t('الأعداد من سجلاتك المصرح بها؛ نطاق التاريخ للفواتير والأحداث المؤرخة. لا يجمع النظام العملات المختلفة.','Counts use your authorized records; dates apply to dated events and invoices. Different currencies are not combined.')}</p><details class="stats-grid dashboard-record-counts" ${countsOpen?'open':''}><summary>${t('أعداد السجلات','Record counts')}</summary><div class="dashboard-count-grid">${Object.entries(data?.counts||{}).filter(([key,value])=>widgets.includes(key)&&value!==null&&(key!=='tasks'||sections.tasks)).map(([key,value])=>`<button type="button" class="stat-card" data-dashboard="source" data-id="${e(key)}" ${data?.layout?.detailWidgets&&!data.layout.detailWidgets.includes(key)?'disabled':''}><strong class="stat-label">${e(t(...(labels[key]||[key,key])))}</strong><span class="stat-value">${e(value??'—')}</span></button>`).join('')}</div></details>${urgentOverview()}${currentOverview()}${performanceOverview()}${movementOverview()}${bankOverview()}${financialOverview()}${supportingSummaries()}${investorsOverview()}${sections.reports&&data?.postedFinancial?.ledger.length?`<h3>${t('الإيرادات والمصروفات المثبتة — حسب تاريخ القيد والعملة','Posted income and expenses — by effective date and currency')}</h3>${CenterForms.table('dashboard-posted:'+actor,data.postedFinancial.ledger.map(r=>({...r,companyName:companyName(r.companyId)})),[['companyName',t('الشركة','Company')],['currency',t('العملة','Currency')],['income',t('الإيرادات المثبتة','Posted income')],['expenses',t('المصروفات المثبتة','Posted expenses')],['postedNet',t('صافي القيود','Posted net')]],'',()=>'',{income:'number',expenses:'number',postedNet:'number'})}`:''}${department?`<p>${t('الأقسام غير المرتبطة مباشرة بالإدارة تظهر بشرطة، ولا تُنسب المبالغ المالية إلى إدارة افتراضية.','Sections without direct department attribution show a dash; financial values are not assigned to an inferred department.')}</p>`:''}${data&&!asUser&&sections.tasks?panel(t('المهام','Tasks'),MyWorkUI.html()):''}${sections.reports?dynamicHTML():''}${sections.tasks&&data?.panels?.tasks.length?`<section class="record-section"><h3>${t('مهامي ضمن النطاق','Tasks in scope')}</h3>${CenterForms.table('dashboard-tasks',data.panels.tasks,[['title',t('المهمة','Task')],['status',t('الحالة','State')],['dueOn',t('الاستحقاق','Due')]],'',()=>'',{dueOn:'date'})}</section>`:''}${sections.alerts&&data?.panels?.alerts.length?`<section class="record-section"><h3>${t('تنبيهات المهام المتأخرة','Overdue task alerts')}</h3>${CenterForms.table('dashboard-alerts',data.panels.alerts,[['title',t('المهمة','Task')],['dueOn',t('الاستحقاق','Due')]],'',()=>'',{dueOn:'date'})}</section>`:''}${source&&data?.sources[source]?details():''}</section>`;
 }
 function bind(){const host=document.getElementById('central-dashboard');if(!host)return;MyWorkUI.bind(host);RegisterView.bind(host,render);bindPreview(host);
 for(const b of host.querySelectorAll('[data-overview-metric]'))b.onclick=()=>openPerformance(b.dataset.overviewMetric);
 for(const b of host.querySelectorAll('[data-overview-task]'))b.onclick=()=>RecordLinks.open('task',b.dataset.overviewTask).catch(err=>alert(err.message));
 for(const b of host.querySelectorAll('[data-overview-month]'))b.onclick=()=>openMovementMonth(b.dataset.overviewMonth);
 for(const b of host.querySelectorAll('[data-overview-year]'))b.onclick=()=>{
  const controls=[...host.querySelectorAll('[data-overview-year]')];
  const selected=new Set(controls.filter(item=>item.getAttribute('aria-pressed')==='true').map(item=>Number(item.dataset.overviewYear)));
  const year=Number(b.dataset.overviewYear);
  if(selected.has(year)&&selected.size===1)return;
  if(selected.has(year))selected.delete(year);else selected.add(year);
  comparisonYears=controls.map(item=>Number(item.dataset.overviewYear)).filter(year=>selected.has(year));render();
  document.querySelector('[data-overview-year="'+year+'"]')?.focus();
 };

 const counts=host.querySelector(".dashboard-record-counts");
 counts?.addEventListener("toggle",()=>{if(counts.isConnected)countsOpen=counts.open;});
 for(const button of host.querySelectorAll('[data-bank-deposits]'))button.onclick=async()=>{
  try{await openBankDeposits(button.dataset.bankDeposits);}
  catch{alert(t('تعذر تحميل إيداعات الحساب.','Unable to load deposits for this account.'));}
 };
 host.querySelector('[data-dashboard="preview-grants"]')?.addEventListener('click',editPreviewGrant);host.querySelector('#dashboard-report')?.addEventListener('change',async ev=>{dynamicReport=ev.target.value;if(dynamicReport==='movement'&&sections.charts){source='';movementFocus=null;await loadMovements();}else{source=dynamicReport;await load();}});for(const[id,set]of [['movement-months',v=>movementMonths=Number(v)],['movement-emirate',v=>movementEmirate=v],['movement-licence',v=>movementLicence=v]])host.querySelector('#'+id)?.addEventListener('change',async ev=>{set(ev.target.value);movementFocus=null;await loadMovements();});host.querySelectorAll('[data-movement]').forEach(b=>b.onclick=()=>{movementFocus={month:b.dataset.month,direction:b.dataset.movement};render();});host.querySelectorAll('[data-movement-vehicle]').forEach(b=>b.onclick=()=>VehicleUI.openNotification(b.dataset.movementVehicle));host.querySelector('#dashboard-search')?.addEventListener('submit',ev=>{ev.preventDefault();searches[source]=ev.target.elements.q.value;render();});for(const b of host.querySelectorAll('[data-dashboard-record]')){b.onclick=()=>openRecord(b.dataset.dashboardRecord).catch(err=>alert(err.message));const row=b.closest('tr');row.tabIndex=0;row.onclick=ev=>{if(!ev.target.closest('button,a,input,select,summary,details'))b.click();};row.onkeydown=ev=>{if(ev.target===row&&['Enter',' '].includes(ev.key)){ev.preventDefault();b.click();}};}for(const [id,set]of [['dashboard-company',v=>company=v],['dashboard-department',v=>department=v],['dashboard-from',v=>from=v],['dashboard-to',v=>to=v]])host.querySelector('#'+id)?.addEventListener('change',async ev=>{set(ev.target.value);await load();if(dynamicReport==='movement'&&sections.charts)await loadMovements();});for(const b of host.querySelectorAll('[data-dashboard]'))b.onclick=async()=>{const a=b.dataset.dashboard;if(a==='preview'||a==='preview-retry'){const target=previewUser||(ABCentral.viewAs?ABCentral.actor.id:'');if(!target)return;b.disabled=true;await ViewAsUI.start(target,{onError:message=>{previewError=message;render();}});return;}if(a==='movement-refresh'){await loadMovements();}else if(a==='back'){source='';render();}else if(a==='owner'){asUser='';source='';await load();}else if(a==='source'||a==='shortcut'){source=b.dataset.id;await load();}else if(a==='refresh')await load();else if(a==='preferences'){await customize();}};}

 function editPreviewGrant(){
  const options=data.targets.filter(u=>u.previewable).map(u=>({id:u.id,name:targetName(u)+' · '+u.username}));
  CenterForms.form(t('صلاحية عرض شاشة المستخدم','User-screen preview access'),[
   {name:'viewerId',ar:'المستخدم المخوّل',en:'Reviewer',options,required:true},
   {name:'targetId',ar:'الشاشة المسموح بمعاينتها',en:'User screen allowed',options,required:true},
   {name:'allowed',ar:'منح صلاحية معاينة هذه الشاشة للقراءة فقط',en:'Grant read-only access to this user screen',type:'checkbox'}
  ],async values=>{
   const allowed=values.allowed===true;
   if(!confirm(allowed?t('سيتمكن المراجع من قراءة بيانات هذه الشاشة وفق صلاحيات المستخدم المختار. تأكيد المنح؟','The reviewer will be able to read this screen with the selected user’s permissions. Confirm grant?'):t('تأكيد سحب صلاحية معاينة هذه الشاشة؟','Confirm removal of this screen preview grant?')))throw Error(t('أُلغي الحفظ','Save cancelled'));
   await CenterForms.api('view-as/grants','POST',{viewerId:values.viewerId,targetId:values.targetId,allowed});
  });
 }
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

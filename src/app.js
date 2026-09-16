import { calculateReport, chartLabelIndices, chartTimeTicks, combineDepositObservations, combineSynchronizedAccountObservations, normalizeObservations, presetRange } from './domain.js';
import { messages, label } from './i18n.js';
import { analyzeDailyBalanceCsv, parseCsv } from './csv.js';
import { clearObservations, getAccounts, getObservations, replaceAccountObservations, saveAccounts, saveObservations } from './storage.js';
import { summaryCsv, downloadText, drawReport } from './export.js';

const checkingSynthetic = [
  { date: '2026-01-01', balance: 3200 }, { date: '2026-02-01', balance: 3450 },
  { date: '2026-03-01', balance: 8100 }, { date: '2026-04-01', balance: 8750 },
  { date: '2026-05-01', balance: 9100 }, { date: '2026-06-01', balance: 8940 },
  { date: '2026-07-01', balance: 9320 }, { date: '2026-07-18', balance: 8400 },
  { date: '2026-07-27', balance: 8710 }, { date: '2026-08-05', balance: 8975 },
  { date: '2026-08-12', balance: 4020 }, { date: '2026-08-17', balance: 4150 }
].map(item=>({...item,accountId:'checking'}));
const savingsSynthetic = [
  {date:'2026-01-01',balance:5000},{date:'2026-03-01',balance:5100},{date:'2026-05-01',balance:5300},{date:'2026-07-01',balance:5500},{date:'2026-08-15',balance:5750}
].map(item=>({...item,accountId:'savings'}));
const defaultAccounts=[{id:'checking',name:'Checking',type:'checking',currency:'USD'},{id:'savings',name:'Savings',type:'savings',currency:'USD'}];

const $ = selector => document.querySelector(selector);
let observations = [];
let accounts = [];
let selectedAccount = 'total';
let selectedPeriod = '30D';
let currentReport = null;
let parsedImport = null;
let parsedAnalysis = null;
let stagedImports = new Map();
let locale = 'en';
let range = { startDate: '2026-07-18', endDate: '2026-08-17' };

const money = value => new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const dateText = date => new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
const periodText = () => selectedPeriod==='ALL'?label('all',locale):selectedPeriod==='CUSTOM'?label('custom',locale):selectedPeriod;
const accountObservations = accountId => normalizeObservations(observations.filter(item=>item.accountId===accountId));
const cashAccounts = () => accounts.filter(account=>account.type==='checking'||account.type==='savings');
const accountName = account => account.id==='checking'||account.id==='savings' ? label(account.type,locale) : account.name;
const accountById = id => accounts.find(account=>account.id===id);
const aggregateView = () => selectedAccount==='total'||selectedAccount==='cash';
const visibleObservations = () => selectedAccount==='total' ? combineDepositObservations(observations,accounts) : selectedAccount==='cash' ? combineSynchronizedAccountObservations(observations,cashAccounts().filter(account=>accountObservations(account.id).length).map(account=>account.id)) : accountObservations(selectedAccount);
const latestDate = () => [...observations].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)?.date;
const entryAccount = () => !aggregateView() ? selectedAccount : accounts.find(account=>!accountObservations(account.id).length)?.id || accounts[0]?.id;
function updateImportState(){const ready=[...stagedImports.entries()].map(([accountId,items])=>`${accountName(accountById(accountId))} · ${items.length}`).join('  ·  ');const activeAccount=$('#import-account').value;const activeReady=parsedAnalysis?.resolved&&$('#balance-confirm')?.checked;const fileCount=stagedImports.size+(activeReady&&!stagedImports.has(activeAccount)?1:0);$('#import-ready').textContent=ready?`${label('ready',locale)}: ${ready}`:'';$('#import-ready').hidden=!ready;$('#import-submit').disabled=!fileCount;$('#import-submit').textContent=fileCount>1?label('importFiles',locale):label('importBalances',locale);}
function resetImportFile(){parsedImport=null;parsedAnalysis=null;$('#csv-file').value='';$('#mapping').hidden=true;$('#date-column').replaceChildren();$('#balance-column').replaceChildren();$('#csv-preview').textContent='';$('#order-status').textContent='';$('#order-choice').hidden=true;$('#row-order').value='';$('#import-error').textContent='';if($('#balance-confirm'))$('#balance-confirm').checked=false;updateImportState();}
function refreshImportPreview(){if(!parsedImport)return;try{const override=$('#row-order').value||null;parsedAnalysis=analyzeDailyBalanceCsv(parsedImport,{date:$('#date-column').value,balance:$('#balance-column').value},override);const needsChoice=!['ascending','descending'].includes(parsedAnalysis.detectedOrder);$('#order-choice').hidden=!needsChoice;const orderText=parsedAnalysis.resolved?label(parsedAnalysis.effectiveOrder==='descending'?'newestFirst':'oldestFirst',locale):label('ambiguousOrder',locale);const ignoredText=parsedAnalysis.ignoredBlankBalances?` · ${label('blankBalancesIgnored',locale)}: ${parsedAnalysis.ignoredBlankBalances}`:'';$('#order-status').textContent=`${orderText}${ignoredText}`;$('#csv-preview').textContent=parsedAnalysis.resolved?[`${label('date',locale)} · ${label('balance',locale)}`,...parsedAnalysis.observations.slice(0,6).map(item=>`${item.date} · ${item.balance.toFixed(2)}`)].join('\n'):'';$('#import-error').textContent='';}catch{parsedAnalysis=null;$('#import-error').textContent=label('invalidCsv',locale);}updateImportState();}
function stageCurrentImport(){if(!parsedImport)return true;try{if(!parsedAnalysis?.resolved)throw new Error('Resolve row order');if(!$('#balance-confirm').checked)throw new Error('Confirm running balance');const accountId=$('#import-account').value;const items=parsedAnalysis.observations.map(item=>({...item,accountId}));stagedImports.set(accountId,items);resetImportFile();return true;}catch{$('#import-error').textContent=parsedAnalysis?.resolved?label('confirmBalanceError',locale):label('ambiguousOrder',locale);return false;}}
function setImportAccount(accountId,{stageFile=true}={}){const changed=$('#import-account').value!==accountId;if(changed&&stageFile&&!stageCurrentImport())return;$('#import-account').value=accountId;document.querySelectorAll('[data-import-account]').forEach(button=>{const selected=button.dataset.importAccount===accountId;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});updateImportState();}

function populateAccountControls(){
  const appendOption=(select,value,name)=>{const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);};
  $('#add-account').replaceChildren();$('#account-view').replaceChildren();$('#clear-scope').replaceChildren();$('#import-account-options').replaceChildren();
  appendOption($('#account-view'),'total',label('totalDeposits',locale));appendOption($('#account-view'),'cash',label('availableCash',locale));appendOption($('#clear-scope'),'all',label('allAccounts',locale));
  for(const account of accounts){const name=accountName(account);appendOption($('#add-account'),account.id,name);appendOption($('#account-view'),account.id,name);appendOption($('#clear-scope'),account.id,name);const button=document.createElement('button');button.type='button';button.className='account-option';button.dataset.importAccount=account.id;button.textContent=name;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>setImportAccount(account.id));$('#import-account-options').append(button);}
  $('#account-view').value=selectedAccount;setImportAccount(accounts.some(account=>account.id===$('#import-account').value)?$('#import-account').value:entryAccount(),{stageFile:false});
  document.querySelectorAll('#account-type option').forEach(option=>option.textContent=label(option.value,locale));
}

function installImportSafetyControls(){const mapping=$('#mapping');const preview=mapping.querySelector('.preview');const orderStatus=document.createElement('div');orderStatus.id='order-status';orderStatus.className='order-status';const orderChoice=document.createElement('label');orderChoice.id='order-choice';orderChoice.className='order-choice';orderChoice.hidden=true;const orderText=document.createElement('span');orderText.id='row-order-label';const rowOrder=document.createElement('select');rowOrder.id='row-order';for(const [value,key] of [['','chooseOrder'],['ascending','oldestFirst'],['descending','newestFirst']]){const option=document.createElement('option');option.value=value;option.dataset.labelKey=key;rowOrder.append(option);}rowOrder.addEventListener('change',refreshImportPreview);orderChoice.append(orderText,rowOrder);preview.before(orderStatus,orderChoice);const confirm=document.createElement('label');confirm.className='check-row';const confirmInput=document.createElement('input');confirmInput.type='checkbox';confirmInput.id='balance-confirm';confirmInput.addEventListener('change',updateImportState);const confirmText=document.createElement('span');confirmText.id='balance-confirm-label';confirm.append(confirmInput,confirmText);const replace=document.createElement('label');replace.className='check-row';const replaceInput=document.createElement('input');replaceInput.type='checkbox';replaceInput.id='replace-existing';replaceInput.checked=true;const replaceText=document.createElement('span');replaceText.id='replace-existing-label';replace.append(replaceInput,replaceText);mapping.after(confirm,replace);$('#date-column').addEventListener('change',refreshImportPreview);$('#balance-column').addEventListener('change',refreshImportPreview);}

function translate() {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  const keys = { '#privacy-label':'privacy','#period-label':'reportingPeriod','#current-label':'currentBalance','#change-label':'balanceChange','#history-label':'balanceHistory','#empty-label':'noData','#import-title':'importTitle','#import-help':'importHelp','#csv-file-label':'csvFile','#date-column-label':'dateColumn','#balance-column-label':'balanceColumn','#preview-label':'preview','#share-title':'shareTitle','#share-help':'shareHelp','#summary-only':'summaryOnly','#share-local':'dataStaysLocal','#report-language-label':'language','#footer-privacy':'dataStaysLocal','#add-title':'addBalance' };
  for (const [selector, key] of Object.entries(keys)) $(selector).childNodes[0].nodeValue = label(key, locale);
  $('#import-button').textContent = label('import', locale); $('#share-button').textContent = label('share', locale); $('#add-button').textContent = `+ ${label('addBalance', locale)}`; $('#empty-add').textContent = label('addBalance', locale); $('#import-submit').textContent = label('importBalances', locale); $('#export-csv').textContent = label('exportCsv', locale); $('#export-png').textContent = label('exportPng', locale);$('#clear-data-button').textContent=label('clearData',locale);$('#clear-title').textContent=label('clearTitle',locale);$('#clear-help').textContent=label('clearHelp',locale);$('#clear-scope-label').textContent=label('clearScope',locale);$('#clear-warning').textContent=label('clearWarning',locale);$('#confirm-clear').textContent=label('clearData',locale);
  $('#view-label').textContent=label('accountView',locale);$('#add-account-label').textContent=label('account',locale);$('#import-account-label').textContent=label('importAccount',locale);$('#import-account-help').textContent=label('importAccountHelp',locale);$('#new-account-button').textContent=`+ ${label('addAccount',locale)}`;$('#account-title').textContent=label('accountTitle',locale);$('#account-help').textContent=label('accountHelp',locale);$('#account-name-label').textContent=label('accountName',locale);$('#account-type-label').textContent=label('accountType',locale);$('#maturity-label').textContent=label('maturityDate',locale);$('#account-save').textContent=label('addAccount',locale);populateAccountControls();
  $('#balance-confirm-label').textContent=label('confirmBalance',locale);$('#replace-existing-label').textContent=label('replaceExisting',locale);
  $('#row-order-label').textContent=label('rowOrder',locale);document.querySelectorAll('#row-order option').forEach(option=>option.textContent=label(option.dataset.labelKey,locale));
}

function drawChart(items) {
  const group = $('#chart-content'); group.replaceChildren();
  if (!items.length) return;
  const values = items.map(item => item.balance), min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const startTime = Date.parse(`${items[0].date}T00:00:00Z`), endTime = Date.parse(`${items.at(-1).date}T00:00:00Z`), timeSpan = endTime - startTime || 1;
  const xForDate = date => 70 + ((Date.parse(`${date}T00:00:00Z`) - startTime) / timeSpan) * 900;
  const tickDates = chartTimeTicks(items[0].date, items.at(-1).date);
  tickDates.slice(0,-1).forEach((date,index)=>{if(index%2)return;const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('x',String(xForDate(date)));rect.setAttribute('y','35');rect.setAttribute('width',String(xForDate(tickDates[index+1])-xForDate(date)));rect.setAttribute('height','270');rect.setAttribute('fill','var(--line)');rect.setAttribute('opacity','.14');group.append(rect);});
  for (let i = 0; i < 4; i += 1) {
    const y = 35 + i * 90;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    Object.entries({ x1:70,x2:970,y1:y,y2:y,stroke:'var(--line)','stroke-width':1 }).forEach(([key,value])=>line.setAttribute(key,value)); group.append(line);
    const text = document.createElementNS('http://www.w3.org/2000/svg','text'); text.setAttribute('x','0'); text.setAttribute('y',String(y+5)); text.setAttribute('fill','var(--muted)'); text.setAttribute('font-size','14'); text.textContent=money(max-(i/3)*span); group.append(text);
  }
  const tickFormat = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', tickDates.length >= 7 ? { month:'short', year:'2-digit' } : { month:'short', day:'numeric' });
  tickDates.forEach((date,index) => {
    const x = xForDate(date);
    const grid = document.createElementNS('http://www.w3.org/2000/svg','line');
    Object.entries({x1:x,x2:x,y1:35,y2:305,stroke:'var(--line)','stroke-width':1,'stroke-dasharray':'3 7'}).forEach(([key,value])=>grid.setAttribute(key,value)); group.append(grid);
    const text = document.createElementNS('http://www.w3.org/2000/svg','text'); text.setAttribute('x',String(x)); text.setAttribute('y','344'); text.setAttribute('fill','var(--muted)'); text.setAttribute('font-size','14'); text.setAttribute('text-anchor',index===0?'start':index===tickDates.length-1?'end':'middle'); text.textContent=tickFormat.format(new Date(`${date}T00:00:00Z`)); group.append(text);
  });
  const points = items.map(item => `${xForDate(item.date)},${305-((item.balance-min)/span)*270}`).join(' ');
  const area = document.createElementNS('http://www.w3.org/2000/svg','polygon'); area.setAttribute('points',`${points} 970,305 70,305`); area.setAttribute('fill','color-mix(in srgb,var(--accent) 12%,transparent)'); group.append(area);
  const line = document.createElementNS('http://www.w3.org/2000/svg','polyline'); line.setAttribute('points',points); line.setAttribute('fill','none'); line.setAttribute('stroke','var(--accent)'); line.setAttribute('stroke-width','5'); line.setAttribute('stroke-linejoin','round'); line.setAttribute('stroke-linecap','round'); group.append(line);
  const labeled = new Set(chartLabelIndices(items));
  for (const [index,item] of items.entries()) {
    const cx=xForDate(item.date), cy=305-((item.balance-min)/span)*270;
    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle'); circle.setAttribute('cx',String(cx)); circle.setAttribute('cy',String(cy)); circle.setAttribute('r','6'); circle.setAttribute('fill','var(--surface)'); circle.setAttribute('stroke','var(--accent)'); circle.setAttribute('stroke-width','4'); const title=document.createElementNS('http://www.w3.org/2000/svg','title'); title.textContent=`${item.date}: ${money(item.balance)}`; circle.append(title); group.append(circle);
    if (labeled.has(index)) { const text=document.createElementNS('http://www.w3.org/2000/svg','text'); text.setAttribute('x',String(cx)); text.setAttribute('y',String(Math.max(22,cy-16))); text.setAttribute('text-anchor',index===0?'start':index===items.length-1?'end':'middle'); text.setAttribute('fill','var(--text)'); text.setAttribute('font-size','13'); text.setAttribute('font-weight','700'); text.setAttribute('paint-order','stroke'); text.setAttribute('stroke','var(--surface)'); text.setAttribute('stroke-width','5'); text.setAttribute('stroke-linejoin','round'); text.textContent=money(item.balance); group.append(text); }
  }
}

function render() {
  const visible=visibleObservations();
  currentReport = calculateReport(visible, range.startDate, range.endDate);
  document.querySelectorAll('[data-preset]').forEach(button=>button.classList.toggle('active',button.dataset.preset===selectedPeriod));
  $('#requested-range').textContent = `${dateText(range.startDate)} — ${dateText(range.endDate)}`;
  $('#start-date').value=range.startDate; $('#end-date').value=range.endDate;
  $('#empty-state').hidden = Boolean(currentReport); $('#dashboard').hidden = !currentReport;
  $('#stale-warning').hidden=true;if (!currentReport) return;
  currentReport.viewName=selectedAccount==='total'?label('totalDeposits',locale):selectedAccount==='cash'?label('availableCash',locale):accountName(accountById(selectedAccount));
  currentReport.viewKey=selectedAccount==='total'?'totalDeposits':selectedAccount==='cash'?'availableCash':accountById(selectedAccount).id===selectedAccount&&['checking','savings'].includes(selectedAccount)?accountById(selectedAccount).type:null;
  currentReport.periodLabel=periodText();
  currentReport.periodKey=selectedPeriod==='ALL'?'all':selectedPeriod==='CUSTOM'?'custom':null;
  const current=visible.at(-1);$('#current-balance').textContent=money(current.balance);
  const reportEnding=visible.find(item=>item.date===currentReport.ending.date);
  currentReport.staleComponents=aggregateView()&&!reportEnding.synchronized;
  currentReport.missingComponents=selectedAccount==='total'&&accounts.some(account=>!accountObservations(account.id).length);
  if(aggregateView()){const asOf=current.components.map(component=>`${accountName(accountById(component.accountId))} ${component.observation.date}`).join(' · ');$('#current-date').textContent=asOf;$('#account-description').textContent=(selectedAccount==='total'?accounts:cashAccounts()).map(account=>accountName(account)).join(' + ');const missing=selectedAccount==='total'?accounts.filter(account=>!accountObservations(account.id).length):[];const warnings=[];if(missing.length)warnings.push(`${label('incompleteAccounts',locale)} ${missing.map(accountName).join(', ')}`);if(!current.synchronized)warnings.push(`${label('carriedBalances',locale)} ${asOf}`);if(warnings.length){$('#stale-warning').textContent=warnings.join('  ');$('#stale-warning').hidden=false;}}else{const account=accountById(selectedAccount);$('#current-date').textContent=dateText(current.date);$('#account-description').textContent=account.maturityDate?`${accountName(account)} · ${label('matures',locale)} ${dateText(account.maturityDate)}`:accountName(account);}
  const sign=currentReport.change>=0?'+':''; $('#balance-change').textContent=`${sign}${money(currentReport.change)}`; $('#balance-change').className=`metric-value compact ${currentReport.change>0?'positive':currentReport.change<0?'negative':''}`;
  $('#percent-change').textContent=currentReport.percentageChange===null?'—':`${sign}${currentReport.percentageChange.toFixed(1)}%`; $('#percent-change').className=`change-percent ${currentReport.change>0?'positive':currentReport.change<0?'negative':''}`;
  if(aggregateView()){const beginning=visible.find(item=>item.date===currentReport.beginning.date);const ending=visible.find(item=>item.date===currentReport.ending.date);const componentDates=item=>item.components.map(component=>`${accountName(accountById(component.accountId))} ${component.observation.date}`).join(', ');$('#actual-dates').textContent=`${label('actualDates',locale)}: ${componentDates(beginning)} → ${componentDates(ending)}`;}else{$('#actual-dates').textContent=`${label('actualDates',locale)}: ${currentReport.beginning.date} → ${currentReport.ending.date}`;} $('#chart-caption').textContent=`${currentReport.observations.length} ${label('observations',locale)} · ${dateText(currentReport.beginning.date)} — ${dateText(currentReport.ending.date)}`;
  drawChart(currentReport.observations);
}

function showStatus(key='saved') { $('#status').textContent=label(key,locale); $('#status').hidden=false; setTimeout(()=>$('#status').hidden=true,3000); }
function openAdd() { $('#add-date').value=latestDate() || new Date().toISOString().slice(0,10); $('#add-account').value=entryAccount(); $('#add-dialog').showModal(); }
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$('#empty-add').addEventListener('click',openAdd); $('#add-button').addEventListener('click',openAdd);
$('#add-form').addEventListener('submit',async event=>{ event.preventDefault(); await saveObservations([{accountId:$('#add-account').value,date:$('#add-date').value,balance:Number($('#add-balance').value)}]); observations=await getObservations(); const visible=visibleObservations();if(visible.length){range={startDate:visible[0].date,endDate:visible.at(-1).date};selectedPeriod='ALL';} $('#add-dialog').close(); showStatus(); render(); });
$('#language').addEventListener('change',event=>{locale=event.target.value;translate();render();});
$('#account-view').addEventListener('change',event=>{selectedAccount=event.target.value;const visible=visibleObservations();if(visible.length){range={startDate:visible[0].date,endDate:visible.at(-1).date};selectedPeriod='ALL';}render();});
$('#new-account-button').addEventListener('click',()=>{$('#account-form').reset();$('#account-type').value='cd';$('#maturity-row').hidden=false;$('#account-error').textContent='';$('#account-dialog').showModal();$('#account-name').focus();});
$('#account-type').addEventListener('change',event=>{$('#maturity-row').hidden=event.target.value!=='cd';if(event.target.value!=='cd')$('#account-maturity').value='';});
$('#account-form').addEventListener('submit',async event=>{event.preventDefault();const name=$('#account-name').value.trim();if(!name||accounts.some(account=>accountName(account).toLocaleLowerCase()===name.toLocaleLowerCase())){$('#account-error').textContent=label('accountNameError',locale);return;}const account={id:crypto.randomUUID(),name,type:$('#account-type').value,currency:'USD'};if(account.type==='cd'&&$('#account-maturity').value)account.maturityDate=$('#account-maturity').value;try{await saveAccounts([account]);accounts=await getAccounts();selectedAccount='total';$('#account-dialog').close();translate();render();showStatus();}catch{$('#account-error').textContent=label('accountNameError',locale);}});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{ document.querySelectorAll('[data-preset]').forEach(item=>item.classList.remove('active'));button.classList.add('active'); const preset=button.dataset.preset;selectedPeriod=preset; if(preset==='CUSTOM'){$('#custom-range').hidden=false;return;} $('#custom-range').hidden=true; const visible=visibleObservations();range=preset==='ALL'?{startDate:visible[0].date,endDate:visible.at(-1).date}:presetRange(preset,visible.at(-1).date);render(); }));
$('#apply-range').addEventListener('click',()=>{range={startDate:$('#start-date').value,endDate:$('#end-date').value};selectedPeriod='CUSTOM';render();});
installImportSafetyControls();$('#import-form').noValidate=true;
$('#import-button').addEventListener('click',()=>{stagedImports=new Map();resetImportFile();setImportAccount(entryAccount(),{stageFile:false});$('#import-dialog').showModal();});
$('#csv-file').addEventListener('change',async event=>{try{parsedImport=parseCsv(await event.target.files[0].text());const options=parsedImport.headers.map(header=>`<option>${header.replaceAll('<','&lt;')}</option>`).join('');$('#date-column').innerHTML=options;$('#balance-column').innerHTML=options;$('#date-column').value=parsedImport.headers.find(h=>/date/i.test(h))||parsedImport.headers[0];$('#balance-column').value=parsedImport.headers.find(h=>/balance/i.test(h))||parsedImport.headers[1];$('#row-order').value='';$('#mapping').hidden=false;$('#import-error').textContent='';refreshImportPreview();}catch{$('#import-error').textContent=label('invalidCsv',locale);}});
$('#import-form').addEventListener('submit',async event=>{event.preventDefault();try{if(!stageCurrentImport()||!stagedImports.size)return;const items=[...stagedImports.values()].flat();const accountIds=[...stagedImports.keys()];if($('#replace-existing').checked)await replaceAccountObservations(items,accountIds);else await saveObservations(items);observations=await getObservations();const visible=visibleObservations();if(visible.length){range={startDate:visible[0].date,endDate:visible.at(-1).date};selectedPeriod='ALL';}$('#import-dialog').close();showStatus();render();}catch{$('#import-error').textContent=label('invalidCsv',locale);}});
function updatePreview(){if(currentReport)drawReport($('#report-preview'),currentReport,$('#report-language').value);}
$('#share-button').addEventListener('click',()=>{updatePreview();$('#share-dialog').showModal();}); $('#report-language').addEventListener('change',updatePreview);
$('#export-csv').addEventListener('click',()=>downloadText(`ledger-summary-${currentReport.ending.date}.csv`,summaryCsv(currentReport,$('#report-language').value),'text/csv;charset=utf-8'));
$('#export-png').addEventListener('click',()=>{$('#report-preview').toBlob(blob=>{const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`ledger-summary-${currentReport.ending.date}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);},'image/png');});
$('#clear-data-button').addEventListener('click',()=>{$('#clear-scope').value=aggregateView()?'all':selectedAccount;$('#clear-dialog').showModal();});
$('#clear-form').addEventListener('submit',async event=>{event.preventDefault();const scope=$('#clear-scope').value;await clearObservations(scope==='all'?null:scope);observations=await getObservations();$('#clear-dialog').close();render();showStatus('cleared');});

accounts=await getAccounts();const freshInstall=!accounts.length;if(freshInstall){await saveAccounts(defaultAccounts);accounts=await getAccounts();}
observations=await getObservations();
if(!observations.length&&freshInstall){await saveObservations([...checkingSynthetic,...savingsSynthetic]);observations=await getObservations();}
const initialVisible=visibleObservations();if(initialVisible.length)range=presetRange('30D',initialVisible.at(-1).date); translate();render();

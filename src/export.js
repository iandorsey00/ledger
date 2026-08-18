import { label } from './i18n.js';
import { chartLabelIndices, chartTimeTicks } from './domain.js';

const csvEscape = value => `"${String(value).replaceAll('"', '""')}"`;

export function summaryCsv(report, mode = 'en') {
  const headers = [label('date', mode), label('balance', mode), label('balanceChange', mode)];
  const rows = report.observations.map((item, index) => [item.date, item.balance.toFixed(2), index ? (item.balance - report.observations[index - 1].balance).toFixed(2) : '']);
  return `\uFEFF${[headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n')}\r\n`;
}

export function downloadText(filename, text, type) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export function drawReport(canvas, report, mode, currency = 'USD') {
  const context = canvas.getContext('2d');
  const width = 1200;
  const height = 860;
  canvas.width = width;
  canvas.height = height;
  const money = value => new Intl.NumberFormat(mode === 'zh' ? 'zh-CN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  const dateParts = (date, options) => {
    const value = new Date(`${date}T00:00:00Z`);
    const english = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(value);
    const chinese = new Intl.DateTimeFormat('zh-CN', { ...options, timeZone: 'UTC' }).format(value);
    return mode === 'bi' ? [english, chinese] : [mode === 'zh' ? chinese : english];
  };
  context.fillStyle = '#f4f3ef'; context.fillRect(0, 0, width, height);
  context.fillStyle = '#181817'; context.font = '700 48px Helvetica Neue, Arial, sans-serif'; context.fillText('家计 · Ledger', 72, 82);
  const viewName = report.viewKey ? label(report.viewKey, mode) : report.viewName || label('summaryOnly', mode);
  const periodName = report.periodKey ? label(report.periodKey, mode) : report.periodLabel || '';
  context.fillStyle = '#63635f'; context.font = '24px Helvetica Neue, Arial, sans-serif'; context.fillText(`${viewName} · ${label('summaryOnly', mode)}`, 72, 124);
  context.fillStyle = '#63635f'; context.font = '22px Helvetica Neue, Arial, sans-serif'; context.fillText(label('currentBalance', mode), 72, 205);
  context.fillStyle = '#181817'; context.font = '700 62px Helvetica Neue, Arial, sans-serif'; context.fillText(money(report.ending.balance), 72, 274);
  context.fillStyle = '#63635f'; context.font = '22px Helvetica Neue, Arial, sans-serif'; context.fillText(label('balanceChange', mode), 680, 205);
  const changeText = `${report.change >= 0 ? '+' : ''}${money(report.change)}${report.percentageChange === null ? '' : ` (${report.percentageChange >= 0 ? '+' : ''}${report.percentageChange.toFixed(1)}%)`}`;
  context.fillStyle = '#181817'; context.font = '700 42px Helvetica Neue, Arial, sans-serif'; context.fillText(changeText, 680, 268);
  const beginningDates=dateParts(report.beginning.date,{year:'numeric',month:'short',day:'numeric'}), endingDates=dateParts(report.ending.date,{year:'numeric',month:'short',day:'numeric'});
  context.fillStyle = '#63635f'; context.font = '21px Helvetica Neue, Arial, sans-serif'; beginningDates.forEach((date,index)=>context.fillText(`${date}  →  ${endingDates[index]}`,680,308+index*27));
  context.fillStyle = '#63635f'; context.font = '21px Helvetica Neue, Arial, sans-serif'; context.fillText(`${label('reportingPeriod', mode)} · ${periodName}`, 72, 372);
  context.fillStyle = '#181817'; context.font = '700 26px Helvetica Neue, Arial, sans-serif'; context.fillText(label('balanceHistory', mode), 72, 416);
  const x = 72, y = 450, w = 1056, h = 260;
  const values = report.observations.map(item => item.balance);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const startTime = Date.parse(`${report.observations[0].date}T00:00:00Z`), endTime = Date.parse(`${report.observations.at(-1).date}T00:00:00Z`), timeSpan = endTime - startTime || 1;
  const pointX = item => x + ((Date.parse(`${item.date}T00:00:00Z`) - startTime) / timeSpan) * w;
  const tickDates = chartTimeTicks(report.observations[0].date, report.observations.at(-1).date);
  tickDates.slice(0,-1).forEach((date,index)=>{if(index%2)return;const left=pointX({date}),right=pointX({date:tickDates[index+1]});context.fillStyle='#eeede8';context.fillRect(left,y,right-left,h);});
  context.strokeStyle = '#d4d3ce'; context.lineWidth = 2; context.strokeRect(x, y, w, h);
  const tickOptions=tickDates.length>=7?{month:'short',year:'2-digit'}:{month:'short',day:'numeric'};
  context.font = '17px Helvetica Neue, Arial, sans-serif';
  tickDates.forEach((date, index) => {
    const px = pointX({ date });
    context.beginPath(); context.setLineDash([3, 7]); context.moveTo(px, y); context.lineTo(px, y + h); context.strokeStyle = '#d4d3ce'; context.lineWidth = 1; context.stroke(); context.setLineDash([]);
    const values = dateParts(date,tickOptions);
    context.fillStyle = '#63635f'; context.textAlign = index === 0 ? 'left' : index === tickDates.length - 1 ? 'right' : 'center'; values.forEach((value,line)=>context.fillText(value,px,750+line*23));
  });
  context.textAlign = 'left';
  context.beginPath();
  report.observations.forEach((item, index) => {
    const px = pointX(item);
    const py = y + h - ((item.balance - min) / span) * (h - 40) - 20;
    index ? context.lineTo(px, py) : context.moveTo(px, py);
  });
  context.strokeStyle = '#1768d7'; context.lineWidth = 6; context.lineJoin = 'round'; context.lineCap = 'round'; context.stroke();
  const labeled = new Set(chartLabelIndices(report.observations, 5));
  report.observations.forEach((item, index) => {
    const px = pointX(item);
    const py = y + h - ((item.balance - min) / span) * (h - 40) - 20;
    context.beginPath(); context.arc(px, py, 6, 0, Math.PI * 2); context.fillStyle = '#f4f3ef'; context.fill(); context.strokeStyle = '#1768d7'; context.lineWidth = 4; context.stroke();
    if (!labeled.has(index)) return;
    const value = money(item.balance); context.font = '700 18px Helvetica Neue, Arial, sans-serif';
    const measured = context.measureText(value).width; const tx = index === 0 ? px : index === report.observations.length - 1 ? px - measured : px - measured / 2; const ty = Math.max(y + 24, py - 18);
    context.fillStyle = '#f4f3ef'; context.fillRect(tx - 5, ty - 18, measured + 10, 24); context.fillStyle = '#181817'; context.fillText(value, tx, ty);
  });
  context.fillStyle = '#63635f'; context.font = '20px Helvetica Neue, Arial, sans-serif'; context.textAlign = 'left';
  context.fillText(label('dataStaysLocal', mode), 72, 830);
}

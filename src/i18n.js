export const messages = {
  en: {
    appName: '家计 Ledger', privacy: 'Private by design · Stored on this device', account: 'Account', importAccount: 'Import into account', importAccountHelp: 'Every balance in this file will be assigned to this account.', accountView: 'Account view', combinedCash: 'Combined cash', checking: 'Checking', savings: 'Savings', currentBalance: 'Current Balance', balanceChange: 'Balance Change', balanceHistory: 'Balance History', reportingPeriod: 'Reporting Period', import: 'Import', share: 'Share', addBalance: 'Add balance', date: 'Date', balance: 'Balance', beginningBalance: 'Beginning balance', endingBalance: 'Ending balance', actualDates: 'Observations used', noData: 'Add a balance or import a CSV to begin.', importTitle: 'Import balance CSV', importHelp: 'Choose columns for a CSV containing historical balances. The file stays on this device.', csvFile: 'CSV file', dateColumn: 'Date column', balanceColumn: 'Balance column', preview: 'Preview', importBalances: 'Import balances', cancel: 'Cancel', shareTitle: 'Share summary', shareHelp: 'Only the period, balances, change, and chart are included. No descriptions or source filenames.', language: 'Report language', exportCsv: 'Export CSV', exportPng: 'Export PNG', summaryOnly: 'Summary (recommended)', custom: 'Custom', saved: 'Your changes have been saved.', invalidCsv: 'Choose a valid CSV with date and balance columns.', dataStaysLocal: 'Nothing is uploaded. Exports are created locally.', clearData: 'Clear data', clearTitle: 'Clear balance data', clearHelp: 'This permanently removes balance observations stored in this browser. Account names will remain.', clearScope: 'Data to clear', clearWarning: 'This cannot be undone. Export anything you want to keep before continuing.'
  },
  zh: {
    appName: '家计 Ledger', privacy: '隐私优先 · 数据仅存于此设备', account: '账户', importAccount: '导入至账户', importAccountHelp: '此文件中的每条余额记录都将归入此账户。', accountView: '账户视图', combinedCash: '合并现金', checking: '支票账户', savings: '储蓄账户', currentBalance: '当前余额', balanceChange: '余额变化', balanceHistory: '余额趋势', reportingPeriod: '报告期间', import: '导入', share: '分享', addBalance: '添加余额', date: '日期', balance: '余额', beginningBalance: '期初余额', endingBalance: '期末余额', actualDates: '采用的观测日期', noData: '添加余额或导入 CSV 以开始。', importTitle: '导入余额 CSV', importHelp: '为含历史余额的 CSV 选择列。文件始终留在此设备。', csvFile: 'CSV 文件', dateColumn: '日期列', balanceColumn: '余额列', preview: '预览', importBalances: '导入余额', cancel: '取消', shareTitle: '分享摘要', shareHelp: '仅包含期间、余额、变化和图表，不包含描述或源文件名。', language: '报告语言', exportCsv: '导出 CSV', exportPng: '导出 PNG', summaryOnly: '摘要（推荐）', custom: '自定义', saved: '你的更改已保存。', invalidCsv: '请选择含日期列和余额列的有效 CSV。', dataStaysLocal: '不会上传任何内容。导出文件在本机生成。', clearData: '清除数据', clearTitle: '清除余额数据', clearHelp: '这会永久删除存储在此浏览器中的余额观测记录。账户名称会保留。', clearScope: '要清除的数据', clearWarning: '此操作无法撤销。请先导出所有需要保留的数据。'
  }
};

messages.en.cleared = 'Balance data cleared.';
messages.zh.cleared = '余额数据已清除。';
messages.en.ready = 'Ready';
messages.zh.ready = '已准备';
messages.en.importFiles = 'Import files';
messages.zh.importFiles = '导入文件';
messages.en.confirmBalance = 'I confirm the selected column is a running account balance, not a transaction amount.';
messages.zh.confirmBalance = '我确认所选列是账户运行余额，而不是单笔交易金额。';
messages.en.confirmBalanceError = 'Confirm that the selected column is a running account balance.';
messages.zh.confirmBalanceError = '请确认所选列是账户运行余额。';
messages.en.replaceExisting = 'Replace existing balance data for each imported account (recommended).';
messages.zh.replaceExisting = '替换每个导入账户的现有余额数据（推荐）。';
messages.en.mismatchedDates = 'Account balances have different as-of dates. The latest combined value may include stale data:';
messages.zh.mismatchedDates = '账户余额的截止日期不同。最新合并值可能包含过期数据：';
messages.en.rowOrder = 'CSV row order';
messages.zh.rowOrder = 'CSV 行顺序';
messages.en.chooseOrder = 'Choose row order';
messages.zh.chooseOrder = '选择行顺序';
messages.en.oldestFirst = 'Oldest transactions first';
messages.zh.oldestFirst = '最早交易在前';
messages.en.newestFirst = 'Newest transactions first';
messages.zh.newestFirst = '最新交易在前';
messages.en.ambiguousOrder = 'The row order is mixed or ambiguous. Choose how transactions are ordered before importing.';
messages.zh.ambiguousOrder = '行顺序混合或不明确。请在导入前选择交易排列方式。';
messages.en.blankBalancesIgnored = 'Blank pending balances ignored';
messages.zh.blankBalancesIgnored = '已忽略空白待处理余额';
messages.en.all = 'All';
messages.zh.all = '全部';

export function label(key, mode = 'en') {
  if (mode === 'bi') return `${messages.en[key]} / ${messages.zh[key]}`;
  return messages[mode]?.[key] || messages.en[key] || key;
}

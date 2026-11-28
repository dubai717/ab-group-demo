import { requireOk } from './core.js';

export const itemAccountFields = ['receivableId', 'revenueId', 'expenseId', 'payableId', 'taxAccountId', 'taxRate'] as const;
const prefix = 'ledger-item-mapping:';
export const itemMappingKey = (itemId: string, companyId: string) => prefix + itemId + ':' + companyId;

export function itemAccountMapping(data: any) {
    return Object.fromEntries(itemAccountFields.map(key => [key, data[key] ?? (key === 'taxRate' ? '0' : null)]));
}

export function requiredItemAccounts(data: any) {
    const accounts: [string, string[]][] = [];
    if (data.invoice || data.receipt) accounts.push(['receivableId', ['asset']]);
    if (data.invoice) accounts.push(['revenueId', ['income', 'liability']]);
    if (data.payment) accounts.push(['expenseId', ['expense', 'liability', 'asset']], ['payableId', ['liability']]);
    if (Number(data.taxRate || 0)) accounts.push(['taxAccountId', ['liability']]);
    return accounts;
}

export async function itemAccountCharts(c: any, companyId: string) {
    return (await c.query(`select ch.definition_id, ch.kind, ch.currency
        from ab.finance_chart ch join ab.finance_accounts a on a.id=ch.definition_id
        where ch.company_id=$1 and ch.active and a.active`, [companyId])).rows;
}

export function validItemAccounts(data: any, charts: any[], currency?: string) {
    // All required accounts must coexist in one currency; each transaction also resolves its own currency.
    const currencies = currency ? [currency] : [...new Set(charts.map(chart => chart.currency))];
    return currencies.some(code => requiredItemAccounts(data).every(([field, kinds]) => charts.some(chart =>
        chart.currency === code && chart.definition_id === data[field] && kinds.includes(chart.kind))));
}

export function companyItemData(definition: any, companyId: string, approved?: any) {
    const original = !definition.mappingPending && (!definition.companyIds?.length || definition.companyIds.includes(companyId));
    return approved ? { ...definition, ...approved } : original ? definition : null;
}

export async function approvedItemMapping(c: any, cipher: any, itemId: string, companyId: string) {
    const row = (await c.query('select value from ab.settings where key=$1', [itemMappingKey(itemId, companyId)])).rows[0];
    return row ? cipher.open(row.value.cipher) : undefined;
}

export async function checkItemAccounts(c: any, data: any, companyId: string, currency?: string) {
    requireOk(validItemAccounts(data, await itemAccountCharts(c, companyId), currency), 409, 'itemAccountingMappingPending');
}

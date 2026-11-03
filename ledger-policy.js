/* Exact accounting rules shared by server/UI. No persistence or default account mappings. */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    else
        root.LedgerPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const rights = ['view', 'invoice_create', 'invoice_correct', 'invoice_import', 'collect', 'collection_override', 'hand_over', 'receive', 'deposit', 'deposit_verify', 'fund_manage', 'petty_spend', 'voucher_create', 'voucher_approve', 'voucher_batch', 'voucher_cancel', 'cheques', 'settle', 'journal_create', 'journal_approve', 'account_manage', 'item_manage', 'statement_upload', 'reconcile', 'close', 'group_close', 'report', 'export', 'configure', 'cards', 'card_settle', 'intercompany', 'audit'].map(x => 'ledger_' + x);
    function units(x) {
        if (!/^-?\d{1,15}(\.\d{1,3})?$/.test(String(x)))
            throw Error('invalidAmount');
        const neg = String(x).startsWith('-'), [a, b = ''] = String(x).replace('-', '').split('.');
        return (BigInt(a) * 1000n + BigInt(b.padEnd(3, '0'))) * (neg ? -1n : 1n);
    }
    function money(x) { return (x < 0n ? '-' : '') + (x < 0n ? -x : x) / 1000n + '.' + ((x < 0n ? -x : x) % 1000n).toString().padStart(3, '0'); }
    function balanced(lines) {
        if (lines.length < 2)
            throw Error('unbalanced');
        const sums = {};
        for (const l of lines) {
            const d = units(l.debit || '0'), c = units(l.credit || '0');
            if (d < 0n || c < 0n || (d > 0n) === (c > 0n))
                throw Error('unbalanced');
            const k = l.companyId + ':' + l.currency;
            sums[k] = (sums[k] || 0n) + d - c;
        }
        if (Object.values(sums).some(x => x !== 0n))
            throw Error('unbalanced');
        return true;
    }
    function distribute(amount, items) {
        let left = units(amount);
        if (left <= 0n)
            throw Error('invalidAmount');
        const allocations = [];
        for (const item of [...items].sort((a, b) => a.priority - b.priority || a.dueOn.localeCompare(b.dueOn) || String(a.id).localeCompare(String(b.id)))) {
            if (left === 0n)
                break;
            const due = units(item.outstanding);
            if (due <= 0n)
                continue;
            const used = left < due ? left : due;
            allocations.push({ id: item.id, itemId: item.itemId, amount: money(used) });
            left -= used;
        }
        return { allocations, excess: money(left) };
    }
    function nextWorkingDay(date, weekdays = [1, 2, 3, 4, 5], holidays = [], days = 1) {
        if (!weekdays.length || weekdays.some(x => x < 0 || x > 6) || !Number.isInteger(days) || days < 1 || days > 30)
            throw Error('invalidCalendar');
        const d = new Date(date + 'T00:00:00Z');
        if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date)
            throw Error('invalidDate');
        let remaining = days;
        for (let n = 0; n < 370; n++) {
            d.setUTCDate(d.getUTCDate() + 1);
            const value = d.toISOString().slice(0, 10);
            if (weekdays.includes(d.getUTCDay()) && !holidays.includes(value) && --remaining === 0)
                return value;
        }
        throw Error('invalidCalendar');
    }
    function cardPhase(day, { statement = false, reconciled = false, missingInvoices = 0, vouchers = false, approved = false, settled = false }) {
        if (settled)
            return 'Settled';
        if (!statement)
            return 'AwaitingStatement';
        if (!reconciled)
            return 'AwaitingReconciliation';
        if (missingInvoices)
            return 'MissingInvoices';
        if (!vouchers)
            return 'AwaitingVouchers';
        if (!approved)
            return day > 5 ? 'UrgentApproval' : 'AwaitingSignature';
        return 'Approved';
    }
    function taxPortion(gross, tax, creditedGross, creditedTax, amount) { const remainingGross = gross - creditedGross, remainingTax = tax - creditedTax; if (gross <= 0n || tax < 0n || tax > gross || amount <= 0n || amount > remainingGross || remainingTax < 0n || remainingTax > remainingGross)
        throw Error('invalidTaxAllocation'); let result = (amount * tax + gross / 2n) / gross; const lower = remainingTax > (remainingGross - amount) ? remainingTax - (remainingGross - amount) : 0n, upper = remainingTax < amount ? remainingTax : amount; if (result < lower)
        result = lower; if (result > upper)
        result = upper; return result; }
    const csvCell = x => '"' + String(x ?? '').replace(/^[\s]*[=+\-@]/, "'$&").replace(/"/g, '""') + '"';
    return { rights, units, money, balanced, distribute, nextWorkingDay, cardPhase, taxPortion, csvCell };
});

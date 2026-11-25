import { randomUUID } from 'node:crypto';
import { ApiError, requireOk, sha } from './core.js';
import { audit } from './data.js';
import { serviceActivation, serviceActivationFrame } from './service-activation-clock.js';
import { actualActorVehicleExecutionEligibility, assertActualVehicleExecutionContext, type VehicleExecutionInput } from './service-eligibility-actor-source.js';
import { vehicleRight } from './vehicle-domain.js';

type Activation = ReturnType<typeof serviceActivation>;
type Settlement = Pick<VehicleExecutionInput, 'customerId' | 'companyId' | 'requestId'>;
const receiptKind = 'service_direct_bank_eligibility_passed';
const sourceKey = (id: string, activation: Activation) =>
  'direct-bank-eligibility:v1:' + id + ':' + (activation.effectiveAt || activation.effectiveFrom);

async function request(c: any, s: any, input: Settlement) {
  const row = (await c.query(`
    select finance_type, funding_state, created_at,
           case when octet_length(payload_cipher)<=65536 then payload_cipher end payload_cipher
    from ab.vehicle_requests
    where id=$1 and tenant_id=$2 and company_id=$3 and customer_id=$4 for update`,
    [input.requestId, s.tenant_id, input.companyId, input.customerId])).rows[0];
  requireOk(row, 404, 'notFound');
  return row;
}

async function settlementEvent(c: any, s: any, cipher: any, input: Settlement, row: any, eventId: string) {
  const event = (await c.query(`
    select actor_id, created_at,
           case when octet_length(payload_cipher)<=262144 then payload_cipher end payload_cipher
    from ab.vehicle_events
    where id=$1 and tenant_id=$2 and company_id=$3 and request_id=$4 and kind='bank_contract_approved'`,
    [eventId, s.tenant_id, input.companyId, input.requestId])).rows[0];
  requireOk(row.finance_type === 'bank' && row.funding_state === 'Approved' &&
    typeof row.payload_cipher === 'string' && typeof event?.payload_cipher === 'string' &&
    row.created_at instanceof Date && event.created_at instanceof Date &&
    event.created_at >= row.created_at && event.created_at.getTime() <= Date.now(),
    409, 'eligibilityContinuationReviewRequired');
  const terms = cipher.open(row.payload_cipher);
  const { schedule, ...approved } = cipher.open(event.payload_cipher)?.after || {};
  requireOk(Array.isArray(schedule) && schedule.length === terms.bankMonths &&
    terms.bankExecution === 'bank_direct' && terms.bankSettlementConfirmed === true &&
    typeof terms.bankSettlementReference === 'string' && terms.bankSettlementReference.trim() &&
    terms.bankContractEvidenceId && JSON.stringify(approved) === JSON.stringify(terms),
    409, 'eligibilityContinuationReviewRequired');
  return event;
}

async function assertDirectBankOwner(c: any, m: any, s: any, companyId: string) {
  const principal = (await c.query('select role_id, status from ab.users where id=$1 and tenant_id=$2',
    [s.user_id, s.tenant_id])).rows[0];
  requireOk(principal?.role_id === 'owner' && principal.status === 'Active' && m.actor.roleId === 'owner' &&
    vehicleRight(m, 'funding_approve', companyId), 403, 'ownerOnly');
}

export function isolatedDirectBankEligibilityGuard(cipher: any, effectiveFrom: string) {
  const activation = serviceActivation(effectiveFrom);
  return async (c: any, m: any, s: any, input: Settlement & { eventId: string }) => {
    const name = (await c.query('select current_database() name')).rows[0]?.name;
    requireOk(/^ab_backup_[a-f0-9]{32}$/.test(name || ''), 503, 'isolatedEligibilityPrototypeOnly');
    if (!serviceActivationFrame(activation, new Date()).active) return;
    await assertDirectBankOwner(c, m, s, input.companyId);
    const { eventId, ...identity } = input;
    const decision = await actualActorVehicleExecutionEligibility(c, m, s, cipher, {
      ...identity, type: 'vehicle', phase: 'disburse',
    });
    if (decision.status !== 'allowed') {
      throw new ApiError(409, decision.status === 'blocked' ? 'newServiceArrearsBlocked' : 'newServiceArrearsReviewRequired');
    }
    const row = await request(c, s, identity);
    const event = await settlementEvent(c, s, cipher, identity, row, eventId);
    requireOk(event.actor_id === s.user_id && /^[a-f0-9]{64}$/.test(decision.sourceVersion),
      409, 'eligibilityContinuationReviewRequired');
    const after = {
      eventId, requestPayloadHash: sha(row.payload_cipher), decisionSourceVersion: decision.sourceVersion,
      effectiveFrom: activation.effectiveFrom, effectiveAt: activation.effectiveAt, financialEffect: false,
    };
    await c.query(`
      insert into ab.vehicle_events(id,tenant_id,company_id,request_id,actor_id,kind,source_key,payload_cipher)
      values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), s.tenant_id, input.companyId, input.requestId, s.user_id, receiptKind,
        sourceKey(input.requestId, activation), cipher.seal({ before: null, after })]);
    await audit(c, s.tenant_id, s.user_id, receiptKind, 'vehicle_request', input.requestId,
      ['originalBankSettlement', 'actualEligibilitySource']);
  };
}

export async function continueEligibleDirectBankSettlement(c: any, s: any, cipher: any, input: Settlement, activation: Activation) {
  const rows = (await c.query(`
    select id, actor_id, created_at,
           case when octet_length(payload_cipher)<=16384 then payload_cipher end payload_cipher
    from ab.vehicle_events
    where tenant_id=$1 and company_id=$2 and request_id=$3 and kind=$4 and source_key=$5 limit 2`,
    [s.tenant_id, input.companyId, input.requestId, receiptKind, sourceKey(input.requestId, activation)])).rows;
  if (!rows.length) return false;
  requireOk(rows.length === 1 && typeof rows[0].payload_cipher === 'string', 409, 'eligibilityContinuationReviewRequired');
  const receipt = rows[0];
  const original = cipher.open(receipt.payload_cipher)?.after;
  const row = await request(c, s, input);
  requireOk(original?.requestPayloadHash === sha(row.payload_cipher || '') &&
    /^[a-f0-9]{64}$/.test(original.decisionSourceVersion) &&
    original.effectiveFrom === activation.effectiveFrom && original.effectiveAt === activation.effectiveAt &&
    original.financialEffect === false, 409, 'eligibilityContinuationReviewRequired');
  const event = await settlementEvent(c, s, cipher, input, row, original.eventId);
  requireOk(event.actor_id === receipt.actor_id && receipt.created_at instanceof Date &&
    event.created_at.getTime() === receipt.created_at.getTime() &&
    serviceActivationFrame(activation, event.created_at).active, 409, 'eligibilityContinuationReviewRequired');
  await audit(c, s.tenant_id, s.user_id, 'service_direct_bank_eligibility_continued', 'vehicle_request',
    input.requestId, ['originalBankSettlement', 'originalEligibilityReceipt']);
  return true;
}

export async function guardDirectBankSettlementReplay(c: any, m: any, s: any, cipher: any, requestId: string, response: any) {
  const row = (await c.query(`
    select customer_id, company_id, funding_state,
           case when octet_length(payload_cipher)<=65536 then payload_cipher end payload_cipher
    from ab.vehicle_requests where id=$1 and tenant_id=$2`, [requestId, s.tenant_id])).rows[0];
  requireOk(row, 404, 'notFound');
  await assertActualVehicleExecutionContext(c, m, s, {
    type: 'vehicle', phase: 'disburse', customerId: row.customer_id, companyId: row.company_id, requestId,
  });
  await assertDirectBankOwner(c, m, s, row.company_id);
  const terms = row.payload_cipher && cipher.open(row.payload_cipher);
  requireOk(row.funding_state === 'Approved' && terms?.bankExecution === 'bank_direct' &&
    terms.bankSettlementConfirmed === true && response?.id === requestId &&
    response.bankContractId === terms.bankContractId, 409, 'eligibilityContinuationReviewRequired');
}

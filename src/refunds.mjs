import {first,run} from './db.mjs';
import {uuid} from './collection.mjs';
import {verifiedPayment,paymentEnvironment} from './billing.mjs';

export async function refundPolicy(db,userId,topupId){
 const row=await first(db,`SELECT t.*,w.balance,w.debt,w.frozen,
  EXISTS(SELECT 1 FROM bw_orders o WHERE o.topup_id=t.id) AS credited,
  EXISTS(SELECT 1 FROM bw_ledger l WHERE l.user_id=t.user_id AND l.kind='spend' AND julianday(l.created_at)>=julianday(t.created_at)) AS consumed
  FROM bw_topups t JOIN bw_wallets w ON w.user_id=t.user_id WHERE t.id=? AND t.user_id=?`,[topupId,userId]);
 if(!row)throw Error('refund_not_found');
 const pending=await first(db,'SELECT id,state FROM bw_refund_requests WHERE topup_id=? AND user_id=?',[topupId,userId]);
 const reason=row.consumed?'refund_service_used':row.debt>0||row.balance<0?'refund_wallet_unavailable':row.credited&&row.balance<row.credits?'refund_insufficient_balance':row.credited?'refund_already_credited':row.frozen?'refund_wallet_unavailable':null;
 return {row,pending,reason};
}
export async function requestDeliveryRefund(db,env,userId,topupId){
 if(!uuid(topupId))throw Error('invalid_request');
 const {row,pending,reason}=await refundPolicy(db,userId,topupId);
 if(pending)return {id:pending.id,status:pending.state};
 if(reason)throw Error(reason);
 const payment=await verifiedPayment(db,env,row);
 if(payment.status!=='succeeded'||payment.refunds.some(r=>r.status!=='failed')||payment.disputes.length)throw Error('refund_payment_unverified');
 const id=crypto.randomUUID();
 try{await run(db,'INSERT INTO bw_refund_requests(id,topup_id,user_id,order_id,amount) VALUES(?,?,?,?,?) ON CONFLICT(topup_id) DO NOTHING',[id,row.id,userId,`dodo:${paymentEnvironment(env)}:${payment.payment_id}`,row.credits*100]);}
 catch(error){const code=['refund_already_credited','refund_service_used','refund_wallet_unavailable'].find(c=>String(error.message).includes(c));throw Error(code||'refund_review_unavailable');}
 const result=await first(db,'SELECT id,state FROM bw_refund_requests WHERE topup_id=? AND user_id=?',[row.id,userId]);
 return {id:result.id,status:result.state};
}

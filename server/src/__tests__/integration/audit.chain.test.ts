import AuditLog from '../../models/AuditLog';
import { appendAudit } from '../../utils/audit';
import { verifyAuditChain } from '../../controllers/adminController';

// verifyAuditChain is an Express handler; drive it with a minimal res that captures res.json().
const runVerify = async (): Promise<any> => {
    let out: any;
    const res: any = { json: (x: any) => { out = x; }, status: () => res };
    await verifyAuditChain({} as any, res);
    return out;
};

describe('audit hash chain', () => {
    it('links records, verifies clean, and flags tampering at the altered row', async () => {
        await appendAudit({ method: 'POST', path: '/api/auth/login', action: 'auth.login', actor: null, ip: '10.0.0.1', status: 200 });
        await appendAudit({
            method: 'DELETE', path: '/api/groups/g/members/u', action: 'group.member.remove',
            actor: { id: 'a1', name: 'Admin One', role: 'Admin' },
            target: { type: 'user', id: 'u', name: 'Victim' }, ip: '10.0.0.2', status: 200,
        });
        await appendAudit({
            method: 'GET', path: '/api/admin/stats', action: 'GET /api/admin/stats',
            actor: { id: 'a1', name: 'Admin One', role: 'Admin' }, ip: '10.0.0.2', status: 200,
        });

        // Chain is linked: monotonic seq, each prevHash points at the prior hash, genesis anchored.
        const all = await AuditLog.find().sort({ seq: 1 }).lean();
        expect(all.map(a => a.seq)).toEqual([1, 2, 3]);
        expect(all[0].prevHash).toBe('GENESIS');
        expect(all[1].prevHash).toBe(all[0].hash);
        expect(all[2].prevHash).toBe(all[1].hash);

        // Verifier agrees the write-path hashes are reproducible.
        const good = await runVerify();
        expect(good.ok).toBe(true);
        expect(good.checked).toBe(3);

        // Tamper: rewrite the actor on record 2 without recomputing its hash.
        await AuditLog.updateOne({ seq: 2 }, { $set: { 'actor.name': 'Someone Else' } });

        const bad = await runVerify();
        expect(bad.ok).toBe(false);
        expect(bad.firstProblem.type).toBe('hash-mismatch');
        expect(bad.firstProblem.at).toBe(2);
    });
});

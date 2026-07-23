/*
 * One-off fix: add a third student to an already-approved group.
 *
 * The in-app "invite" flow blocks additions once a proposal is Approved
 * (groupController.ts:380). This script appends the student straight into the
 * group's `members` array, which is what the app would ultimately do anyway.
 *
 * Usage (run from the server/ directory):
 *   node add-third-member.js <newMemberRoll> <existingMemberRoll>
 *
 *   newMemberRoll      roll number of the student to add
 *   existingMemberRoll roll number of someone already in the target group
 *                      (used only to locate the group)
 *
 * Nothing is written until you confirm the printed group is correct — run once
 * to preview, then re-run with APPLY=1 to commit.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const [newRoll, existingRoll] = process.argv.slice(2);
const APPLY = process.env.APPLY === '1';

if (!newRoll || !existingRoll) {
    console.error('Usage: node add-third-member.js <newMemberRoll> <existingMemberRoll>');
    process.exit(1);
}

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/minor_management';

(async () => {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    console.log(`Connected to: ${uri.replace(/\/\/[^@]*@/, '//<redacted>@')}\n`);

    const users = db.collection('users');
    const groups = db.collection('groups');

    const rx = (s) => new RegExp(`^${s.trim()}$`, 'i');

    const newUser = await users.findOne({ rollNumber: rx(newRoll) });
    const existingUser = await users.findOne({ rollNumber: rx(existingRoll) });

    if (!newUser) throw new Error(`No user with roll number "${newRoll}"`);
    if (!existingUser) throw new Error(`No user with roll number "${existingRoll}"`);
    if (newUser.role !== 'Student') throw new Error(`${newUser.name} is not a Student (role=${newUser.role})`);

    // The student must not already sit in another active group / pending invite.
    const clash = await groups.findOne({
        $or: [{ members: newUser._id }, { pendingMembers: newUser._id }],
        isArchived: { $ne: true },
    });

    const group = await groups.findOne({ members: existingUser._id, isArchived: { $ne: true } });
    if (!group) throw new Error(`No active group contains ${existingUser.name} (${existingRoll})`);

    if (clash && String(clash._id) !== String(group._id)) {
        throw new Error(`${newUser.name} is already in another active group (${clash.name || clash._id})`);
    }

    const alreadyIn = (group.members || []).some((m) => String(m) === String(newUser._id));
    const memberDocs = await users
        .find({ _id: { $in: group.members } })
        .project({ name: 1, rollNumber: 1 })
        .toArray();

    console.log(`Group:   ${group.name || '(unnamed)'}  [${group._id}]`);
    console.log(`Status:  ${group.status}`);
    console.log(`Members: ${memberDocs.map((m) => `${m.name} (${m.rollNumber})`).join(', ')}`);
    console.log(`Adding:  ${newUser.name} (${newUser.rollNumber})\n`);

    if (alreadyIn) {
        console.log('Nothing to do — student is already a member.');
    } else if ((group.members || []).length >= 3) {
        throw new Error('Group already has 3 members; cannot add a fourth.');
    } else if (!APPLY) {
        console.log('DRY RUN. Re-run with APPLY=1 to commit, e.g.:');
        console.log(`   APPLY=1 node add-third-member.js ${newRoll} ${existingRoll}`);
    } else {
        await groups.updateOne(
            { _id: group._id },
            { $addToSet: { members: newUser._id }, $pull: { pendingMembers: newUser._id } }
        );
        console.log('✔ Added. New member count:', (group.members || []).length + 1);
    }

    await mongoose.disconnect();
})().catch(async (err) => {
    console.error('ERROR:', err.message);
    await mongoose.disconnect();
    process.exit(1);
});

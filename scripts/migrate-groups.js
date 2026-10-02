const mongoose = require('mongoose');

const collections = ['householdmembers', 'expenses', 'bills'];
const legacyFilter = { householdId: { $exists: true } };
const conflictFilter = {
  ...legacyFilter,
  groupId: { $exists: true },
  $expr: { $ne: ['$householdId', '$groupId'] }
};

// Raw collections bypass Mongoose strict schemas and leave timestamps untouched.
async function migrateGroups(db, { dryRun = true, log = console.log } = {}) {
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  const present = collections.filter(name => names.has(name));
  // Check every collection before changing anything. Never overwrite a conflict.
  for (const name of present) {
    const count = await db.collection(name).countDocuments(conflictFilter);
    if (count) throw new Error(`${name}: ${count} conflicting relationship fields; no migration performed.`);
  }
  for (const name of present) {
    const collection = db.collection(name);
    const count = await collection.countDocuments(legacyFilter);
    log(`${name}: ${count} legacy relationships${dryRun ? ' (dry run)' : ''}`);
    if (!dryRun) {
      // Recheck conflict condition in the write predicate as a defensive guard.
      await collection.updateMany({
        ...legacyFilter,
        $or: [{ groupId: { $exists: false } }, { $expr: { $eq: ['$groupId', '$householdId'] } }]
      }, [{ $set: { groupId: '$householdId' } }, { $unset: 'householdId' }]);
      if (await collection.countDocuments(legacyFilter)) {
        throw new Error(`${name}: legacy fields remain; stop writers and rerun.`);
      }
    }
  }
}

async function main() {
  require('dotenv').config();
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: node scripts/migrate-groups.js [--dry-run | --apply]');
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    await migrateGroups(mongoose.connection.db, { dryRun: !args.includes('--apply') });
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
module.exports = { migrateGroups };

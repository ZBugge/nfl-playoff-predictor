import { runQuery, runExec } from './src/db/schema.js';

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.error('Usage: npx tsx make-super-admin.ts <username>');
    console.log('\nAvailable admins:');
    const allAdmins = await runQuery('SELECT id, username, is_super_admin FROM admins', []);
    if (allAdmins.length === 0) {
      console.log('  No admins found. Please register an admin account first.');
    } else {
      allAdmins.forEach((admin: any) => {
        console.log(`  - ${admin.username} (id: ${admin.id}, super_admin: ${admin.is_super_admin ? 'yes' : 'no'})`);
      });
    }
    process.exit(1);
  }

  try {
    const admins = await runQuery('SELECT id, username, is_super_admin FROM admins WHERE username = ?', [username]);

    if (admins.length === 0) {
      console.error(`Admin with username "${username}" not found.`);
      console.log('\nAvailable admins:');
      const allAdmins = await runQuery('SELECT id, username, is_super_admin FROM admins', []);
      allAdmins.forEach((admin: any) => {
        console.log(`  - ${admin.username} (id: ${admin.id}, super_admin: ${admin.is_super_admin ? 'yes' : 'no'})`);
      });
      process.exit(1);
    }

    const admin = admins[0];

    if (admin.is_super_admin) {
      console.log(`${username} is already a super admin.`);
      process.exit(0);
    }

    await runExec('UPDATE admins SET is_super_admin = 1 WHERE username = ?', [username]);
    console.log(`✓ Successfully made ${username} a super admin!`);
    console.log('Please log out and log back in for the changes to take effect.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

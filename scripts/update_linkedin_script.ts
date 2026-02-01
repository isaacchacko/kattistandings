import { prisma } from '../lib/prisma';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function updateLinkedInScript() {
  try {
    // Get all unique user names from database
    const allRanks = await prisma.rank.findMany({
      select: {
        name: true,
      },
    });

    // Extract unique user names (excluding "Hidden User")
    const uniqueUserNames = new Set<string>();
    allRanks.forEach(rank => {
      if (rank.name.toLowerCase() !== 'hidden user') {
        uniqueUserNames.add(rank.name);
      }
    });

    // Sort for consistency
    const userNames = Array.from(uniqueUserNames).sort();

    console.log(`Found ${userNames.length} unique users:`);
    userNames.slice(0, 10).forEach(name => console.log(`  - ${name}`));
    if (userNames.length > 10) {
      console.log(`  ... and ${userNames.length - 10} more`);
    }

    // Read the Python script
    const scriptPath = join(__dirname, 'collect_linkedin_urls.py');
    let scriptContent = readFileSync(scriptPath, 'utf-8');

    // Generate the USER_NAMES list as a Python array
    const userNamesArray = userNames.map(name => `    "${name}"`).join(',\n');
    const userNamesVar = `USER_NAMES = [\n${userNamesArray},\n]`;

    // Replace the USER_NAMES variable (should be USER_NAMES = [])
    const userNamesPattern = /USER_NAMES = \[[\s\S]*?\]/;
    if (userNamesPattern.test(scriptContent)) {
      scriptContent = scriptContent.replace(userNamesPattern, userNamesVar);
      console.log('\nUpdated USER_NAMES variable with database users');
    } else {
      // Insert after the comment
      scriptContent = scriptContent.replace(
        /(# Run: npx tsx scripts\/update_linkedin_script\.ts to update from database\n)USER_NAMES = \[\]/,
        `$1${userNamesVar}`
      );
      console.log('\nUpdated USER_NAMES variable with database users');
    }

    // Write the updated script
    writeFileSync(scriptPath, scriptContent, 'utf-8');
    console.log(`\n✓ Updated ${scriptPath} with ${userNames.length} user names`);

    // Also save to JSON file for backup
    const jsonPath = join(__dirname, '..', 'user_names.json');
    writeFileSync(jsonPath, JSON.stringify(userNames, null, 2), 'utf-8');
    console.log(`✓ Saved user names to ${jsonPath}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateLinkedInScript();

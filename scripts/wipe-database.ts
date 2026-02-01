import { prisma } from '../lib/prisma';

async function wipeDatabase() {
  console.log('Starting database wipe...');
  
  try {
    // Delete in order to respect foreign key constraints
    console.log('Deleting all ranks...');
    const ranksDeleted = await prisma.rank.deleteMany({});
    console.log(`Deleted ${ranksDeleted.count} rank records`);
    
    console.log('Deleting all assignment entries...');
    const entriesDeleted = await prisma.assignmentEntry.deleteMany({});
    console.log(`Deleted ${entriesDeleted.count} assignment entry records`);
    
    console.log('Deleting all assignments...');
    const assignmentsDeleted = await prisma.assignment.deleteMany({});
    console.log(`Deleted ${assignmentsDeleted.count} assignment records`);
    
    console.log('Database wipe completed successfully!');
  } catch (error) {
    console.error('Error wiping database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

wipeDatabase();

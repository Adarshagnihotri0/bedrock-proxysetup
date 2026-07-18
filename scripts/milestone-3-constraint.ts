/**
 * Milestone 3: Unique Constraint on Knowledge.id
 * 
 * Requirements:
 * 1. Create unique constraint: Knowledge.id IS UNIQUE
 * 2. Test duplicate prevention
 * 
 * Rationale: Never rely only on MERGE - database constraints are part of correctness
 */

import neo4j from 'neo4j-driver';

async function createUniqueConstraint() {
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'test1234')
  );

  const session = driver.session();

  try {
    console.log('🔬 Milestone 3: Unique Constraint on Knowledge.id\n');

    // STEP 1: Create constraint
    console.log('STEP 1: Creating unique constraint...');
    await session.run(`
      CREATE CONSTRAINT knowledge_id_unique IF NOT EXISTS
      FOR (k:Knowledge)
      REQUIRE k.id IS UNIQUE
    `);
    console.log('  ✅ Constraint created\n');

    // STEP 2: Verify constraint exists
    console.log('STEP 2: Verifying constraint...');
    const constraints = await session.run(`
      SHOW CONSTRAINTS
      WHERE name = 'knowledge_id_unique'
    `);

    if (constraints.records.length > 0) {
      console.log('  ✅ Constraint verified\n');
    } else {
      console.log('  ❌ Constraint not found\n');
      return false;
    }

    // STEP 3: Test duplicate prevention
    console.log('STEP 3: Testing duplicate prevention...');
    
    const testId = 'test-duplicate-check';
    
    // Insert first
    await session.run(`
      MERGE (k:Knowledge {id: $id})
      ON CREATE SET k.test = true
    `, { id: testId });

    // Try to create duplicate (should fail with constraint)
    try {
      await session.run(`
        CREATE (k:Knowledge {id: $id})
      `, { id: testId });
      
      console.log('  ❌ DUPLICATE ALLOWED (constraint failed)\n');
      return false;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('already exists') || errorMsg.includes('unique')) {
        console.log('  ✅ Duplicate prevented (constraint working)\n');
        return true;
      } else {
        console.log(`  ❌ UNEXPECTED ERROR: ${errorMsg}\n`);
        return false;
      }
    } finally {
      // Cleanup test node
      await session.run('MATCH (k:Knowledge {id: $id}) DELETE k', { id: testId });
    }

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('❌ Error:', errorMsg);
    return false;
  } finally {
    await session.close();
    await driver.close();
  }
}

createUniqueConstraint()
  .then((success) => {
    if (success) {
      console.log('✅ Milestone 3 complete: Unique constraint enforced');
      process.exit(0);
    } else {
      console.log('❌ Milestone 3 failed');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('❌ Execution failed:', err);
    process.exit(1);
  });

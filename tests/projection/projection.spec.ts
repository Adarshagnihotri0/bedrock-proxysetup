/**
 * Projection Test Suite
 * 
 * VALIDATION ORDER (from PRINCIPLES.md):
 * 1. Single event projection
 * 2. 100 events → 100 nodes
 * 3. Delete, replay, count equality
 * 4. Idempotency (replay twice, no duplicates)
 * 5. Partial projection continuation
 * 
 * NOT YET VALIDATED:
 * - Crash recovery (persisted state)
 * - Semantic equality verification
 * - Concurrent workers
 * - Performance at scale
 */

import { Neo4jProjectionBackend } from '../../src/projection/neo4j-backend';
import { Knowledge } from '../../src/projection/types';

describe('Neo4jProjectionBackend', () => {
  let backend: Neo4jProjectionBackend;

  beforeAll(async () => {
    backend = new Neo4jProjectionBackend();
    await backend.connect();
  });

  afterAll(async () => {
    await backend.close();
  });

  // ========================================
  // TEST 1: Single Event Projection
  // ========================================
  describe('TEST 1: Single event projection', () => {
    it('should project a single Knowledge event', async () => {
      const knowledge: Knowledge = {
        id: 'test-k-1',
        hash: 'hash-001',
        subject: 'build_command',
        predicate: 'failed_with',
        object: 'compilation_error',
        type: 'fact',
        confidence: 0.95,
        evidenceIds: ['e:1', 'e:2'],
        provenance: {
          createdAt: new Date(),
          repository: 'bedrock-proxy'
        }
      };

      await backend.apply(knowledge);

      const retrieved = await backend.get('hash-001');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.hash).toBe('hash-001');
      expect(retrieved?.subject).toBe('build_command');
      expect(retrieved?.predicate).toBe('failed_with');
      expect(retrieved?.object).toBe('compilation_error');
      expect(retrieved?.confidence).toBe(0.95);
      expect(retrieved?.evidenceIds).toEqual(['e:1', 'e:2']);

      // Cleanup
      await backend.deleteAll();
    });
  });

  // ========================================
  // TEST 2: 100 Events → 100 Nodes
  // ========================================
  describe('TEST 2: Batch projection', () => {
    it('should project 100 Knowledge events', async () => {
      const events: Knowledge[] = [];
      
      for (let i = 0; i < 100; i++) {
        events.push({
          id: `test-k-${i}`,
          hash: `batch-hash-${i}`,
          subject: `entity:${i}`,
          predicate: 'relates_to',
          object: `entity:${i + 1}`,
          type: 'relationship',
          confidence: Math.random(),
          evidenceIds: [`e:${i}`],
          provenance: {
            createdAt: new Date(),
            repository: 'bedrock-proxy'
          }
        });
      }

      await backend.applyBatch(events);

      const count = await backend.count();
      expect(count).toBe(100);

      // Cleanup
      await backend.deleteAll();
    });
  });

  // ========================================
  // TEST 3: Delete & Rebuild (Count Equality)
  // ========================================
  describe('TEST 3: Rebuild count equality', () => {
    it('should rebuild with same node count', async () => {
      // Project 10 events
      const events: Knowledge[] = [];
      
      for (let i = 0; i < 10; i++) {
        events.push({
          id: `test-k-${i}`,
          hash: `rebuild-hash-${i}`,
          subject: `user:${i}`,
          predicate: 'performed',
          object: `action:${i}`,
          type: 'fact',
          confidence: 0.9,
          evidenceIds: [`e:${i}`],
          provenance: {
            createdAt: new Date(),
            repository: 'bedrock-proxy'
          }
        });
      }

      await backend.applyBatch(events);
      
      // Get initial state
      const initialCount = await backend.count();

      // Delete all
      await backend.deleteAll();
      
      // Verify deletion
      const afterDelete = await backend.count();
      expect(afterDelete).toBe(0);

      // Rebuild
      await backend.applyBatch(events);
      
      // Verify rebuild
      const afterRebuild = await backend.count();
      expect(afterRebuild).toBe(initialCount);
      expect(afterRebuild).toBe(10);

      // Cleanup
      await backend.deleteAll();
    });
  });

  // ========================================
  // TEST 4: Idempotency
  // ========================================
  describe('TEST 4: Idempotency', () => {
    it('should not create duplicates on replay', async () => {
      const knowledge: Knowledge = {
        id: 'test-k-idem',
        hash: 'idem-hash-001',
        subject: 'user:alice',
        predicate: 'owns',
        object: 'resource:456',
        type: 'fact',
        confidence: 0.85,
        evidenceIds: ['e:1'],
        provenance: {
          createdAt: new Date(),
          repository: 'bedrock-proxy'
        }
      };

      // Apply same event 10 times
      for (let i = 0; i < 10; i++) {
        await backend.apply(knowledge);
      }

      const count = await backend.count();
      expect(count).toBe(1); // NOT 10

      const retrieved = await backend.get('idem-hash-001');
      expect(retrieved?.hash).toBe('idem-hash-001');

      // Cleanup
      await backend.deleteAll();
    });

    it('should update confidence on re-application', async () => {
      const knowledge1: Knowledge = {
        id: 'test-k-update',
        hash: 'update-hash-001',
        subject: 'user:bob',
        predicate: 'created',
        object: 'trace:789',
        type: 'fact',
        confidence: 0.7,
        evidenceIds: ['e:1'],
        provenance: {
          createdAt: new Date(),
          repository: 'bedrock-proxy'
        }
      };

      await backend.apply(knowledge1);

      // Same hash, new confidence
      const knowledge2: Knowledge = {
        ...knowledge1,
        confidence: 0.95,
        evidenceIds: ['e:1', 'e:2'] // More evidence
      };

      await backend.apply(knowledge2);

      const retrieved = await backend.get('update-hash-001');
      expect(retrieved?.confidence).toBe(0.95); // Updated
      expect(retrieved?.evidenceIds).toEqual(['e:1', 'e:2']); // Updated

      // Cleanup
      await backend.deleteAll();
    });
  });

  // ========================================
  // TEST 5: Partial Projection Continuation
  // ========================================
  describe('TEST 5: Partial projection', () => {
    it('should handle partial projection', async () => {
      const events: Knowledge[] = [];
      
      for (let i = 0; i < 100; i++) {
        events.push({
          id: `test-k-crash-${i}`,
          hash: `crash-hash-${i}`,
          subject: `entity:${i}`,
          predicate: 'relates_to',
          object: `entity:${i + 1}`,
          type: 'relationship',
          confidence: 0.8,
          evidenceIds: [`e:${i}`],
          provenance: {
            createdAt: new Date(),
            repository: 'bedrock-proxy'
          }
        });
      }

      // Simulate crash: project 50 events
      await backend.applyBatch(events.slice(0, 50));
      
      const afterCrash = await backend.count();
      expect(afterCrash).toBe(50);

      // Resume: project remaining 50
      await backend.applyBatch(events.slice(50, 100));
      
      const afterResume = await backend.count();
      expect(afterResume).toBe(100);

      // Cleanup
      await backend.deleteAll();
    });
  });
});

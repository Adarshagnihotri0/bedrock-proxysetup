/**
 * Memory Profiler for Streaming Validation
 * 
 * Prove streaming is real by measuring:
 * - Peak heap usage
 * - RSS (resident set size)
 * - Memory growth over time
 * 
 * Compare: pg.query() vs pg-query-stream
 */

import { Pool } from 'pg';
// @ts-ignore
import QueryStream from 'pg-query-stream';
import * as v8 from 'v8';
import * as process from 'process';

function getMemoryMB() {
  const mem = process.memoryUsage();
  return {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024)
  };
}

async function profileBufferedQuery(count: number) {
  const pg = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'bedrock_proxy',
    user: 'adarshagnihotri',
    password: ''
  });

  try {
    console.log(`\n📊 Buffered Query (pg.query)\n`);
    console.log(`Initial memory: ${JSON.stringify(getMemoryMB())}`);

    // Load ALL rows into memory
    const start = Date.now();
    const result = await pg.query(`
      SELECT hash, subject, predicate, object, confidence
      FROM knowledge
      WHERE hash IS NOT NULL
      ORDER BY created_at ASC
      LIMIT $1
    `, [count]);

    const afterLoad = getMemoryMB();
    const elapsed = Date.now() - start;

    console.log(`Loaded ${result.rows.length} rows`);
    console.log(`After load: ${JSON.stringify(afterLoad)}`);
    console.log(`Elapsed: ${elapsed}ms`);
    console.log(`Peak heap: ${afterLoad.heapUsed} MB`);

    return {
      method: 'buffered',
      rows: result.rows.length,
      peakHeapMB: afterLoad.heapUsed,
      rssMB: afterLoad.rss,
      elapsedMs: elapsed
    };
  } finally {
    await pg.end();
  }
}

async function profileStreamingQuery(count: number) {
  const pg = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'bedrock_proxy',
    user: 'adarshagnihotri',
    password: ''
  });

  try {
    console.log(`\n📊 Streaming Query (pg-query-stream)\n`);
    console.log(`Initial memory: ${JSON.stringify(getMemoryMB())}`);

    // Stream rows in batches
    let rows = 0;
    let peakHeap = 0;
    const samples: number[] = [];

    const start = Date.now();
    const query = new QueryStream(`
      SELECT hash, subject, predicate, object, confidence
      FROM knowledge
      WHERE hash IS NOT NULL
      ORDER BY created_at ASC
      LIMIT $1
    `, [count], { batchSize: 100 });

    for await (const row of pg.query(query)) {
      rows++;
      
      // Sample memory every 100 rows
      if (rows % 100 === 0) {
        const mem = getMemoryMB();
        samples.push(mem.heapUsed);
        if (mem.heapUsed > peakHeap) {
          peakHeap = mem.heapUsed;
        }
      }
    }

    const afterStream = getMemoryMB();
    const elapsed = Date.now() - start;

    console.log(`Streamed ${rows} rows`);
    console.log(`After stream: ${JSON.stringify(afterStream)}`);
    console.log(`Elapsed: ${elapsed}ms`);
    console.log(`Peak heap: ${peakHeap} MB`);
    console.log(`Memory samples (every 100 rows): [${samples.slice(0, 5).join(', ')}... ${samples.slice(-1)}]`);

    return {
      method: 'streaming',
      rows,
      peakHeapMB: peakHeap,
      rssMB: afterStream.rss,
      elapsedMs: elapsed,
      samples
    };
  } finally {
    await pg.end();
  }
}

async function main() {
  const count = parseInt(process.argv[2] || '1001');
  
  console.log('🔬 Memory Profiling: Buffered vs Streaming');
  console.log('='.repeat(60));

  // Force garbage collection before tests
  if (global.gc) {
    global.gc();
  }

  // Test 1: Buffered (all in memory)
  const bufferedStats = await profileBufferedQuery(count);

  // Force GC between tests
  if (global.gc) {
    global.gc();
  }
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Streaming (batched)
  const streamingStats = await profileStreamingQuery(count);

  // Compare
  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON');
  console.log('='.repeat(60));
  console.log(`Rows: ${count}`);
  console.log(`\nBuffered: ${bufferedStats.peakHeapMB} MB peak`);
  console.log(`Streaming: ${streamingStats.peakHeapMB} MB peak`);
  console.log(`\nDifference: ${bufferedStats.peakHeapMB - streamingStats.peakHeapMB} MB saved`);
  console.log(`\nThroughput:`);
  console.log(`  Buffered: ${Math.round(count / (bufferedStats.elapsedMs / 1000))} rows/sec`);
  console.log(`  Streaming: ${Math.round(count / (streamingStats.elapsedMs / 1000))} rows/sec`);

  const savingsPercent = Math.round((1 - streamingStats.peakHeapMB / bufferedStats.peakHeapMB) * 100);
  console.log(`\n✅ Streaming reduces peak memory by ${savingsPercent}%`);
}

main()
  .then(() => {
    console.log('\n✅ Profiling complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Profiling failed:', err);
    process.exit(1);
  });

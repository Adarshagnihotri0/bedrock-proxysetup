import neo4j, { Driver, Session } from 'neo4j-driver';

export interface MemoryNode {
  id: string;
  type: 'conversation' | 'concept' | 'decision' | 'preference';
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
  sessionId?: string;
}

export interface MemoryEdge {
  from: string;
  to: string;
  type: 'relates_to' | 'follows' | 'contradicts' | 'supports';
  weight?: number;
}

export interface MemoryQuery {
  text: string;
  limit?: number;
  types?: MemoryNode['type'][];
  sessionId?: string;
}

export interface MemoryResult {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  relevanceScore: number;
}

export class GraphitiClient {
  private driver: Driver | null = null;
  private connected: boolean = false;
  private uri: string;
  private user: string;
  private password: string;

  constructor() {
    this.uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    this.user = process.env.NEO4J_USER || 'neo4j';
    this.password = process.env.NEO4J_PASSWORD || 'test1234';
  }

  async connect(): Promise<boolean> {
    if (this.connected) return true;

    try {
      this.driver = neo4j.driver(
        this.uri,
        neo4j.auth.basic(this.user, this.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 10000,
        }
      );

      // Verify connection
      await this.driver.verifyConnectivity();
      this.connected = true;
      console.log('✓ Graphiti connected to Neo4j');
      return true;
    } catch (error) {
      console.error('✗ Graphiti connection failed:', error);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.connected = false;
    }
  }

  async storeMemory(node: MemoryNode): Promise<string | null> {
    if (!this.connected || !this.driver) {
      console.warn('Graphiti not connected, skipping memory storage');
      return null;
    }

    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        CREATE (n:Memory {
          id: $id,
          type: $type,
          content: $content,
          metadata: $metadata,
          timestamp: $timestamp,
          sessionId: $sessionId,
          createdAt: datetime()
        })
        RETURN n.id as id
        `,
        {
          id: node.id || this.generateId(),
          type: node.type,
          content: node.content,
          metadata: node.metadata || {},
          timestamp: node.timestamp || Date.now(),
          sessionId: node.sessionId || 'default',
        }
      );

      const id = result.records[0]?.get('id');
      console.log(`✓ Stored memory: ${id}`);
      return id;
    } catch (error) {
      console.error('Failed to store memory:', error);
      return null;
    } finally {
      await session.close();
    }
  }

  async storeEdge(edge: MemoryEdge): Promise<void> {
    if (!this.connected || !this.driver) return;

    const session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (from:Memory {id: $from})
        MATCH (to:Memory {id: $to})
        MERGE (from)-[r:${edge.type.toUpperCase()}]->(to)
        SET r.weight = $weight, r.createdAt = datetime()
        `,
        {
          from: edge.from,
          to: edge.to,
          weight: edge.weight || 1.0,
        }
      );
    } catch (error) {
      console.error('Failed to store edge:', error);
    } finally {
      await session.close();
    }
  }

  async queryMemories(query: MemoryQuery): Promise<MemoryResult> {
    if (!this.connected || !this.driver) {
      return { nodes: [], edges: [], relevanceScore: 0 };
    }

    const session = this.driver.session();
    try {
      // Text-based search with optional type filter
      const typeFilter = query.types && query.types.length > 0
        ? `AND n.type IN $types`
        : '';

      const sessionFilter = query.sessionId
        ? `AND n.sessionId = $sessionId`
        : '';

      const cypher = `
        MATCH (n:Memory)
        WHERE n.content CONTAINS $text
        ${typeFilter}
        ${sessionFilter}
        WITH n
        ORDER BY n.timestamp DESC
        LIMIT $limit
        OPTIONAL MATCH (n)-[r]-(m:Memory)
        RETURN n, collect({edge: r, node: m}) as related
      `;

      const result = await session.run(cypher, {
        text: query.text,
        types: query.types || [],
        sessionId: query.sessionId,
        limit: query.limit || 10,
      });

      const nodes: MemoryNode[] = [];
      const edges: MemoryEdge[] = [];
      const seenNodeIds = new Set<string>();
      const seenEdgeKeys = new Set<string>();

      for (const record of result.records) {
        const n = record.get('n');
        const nodeId = n.properties.id;

        if (!seenNodeIds.has(nodeId)) {
          nodes.push({
            id: nodeId,
            type: n.properties.type,
            content: n.properties.content,
            metadata: n.properties.metadata,
            timestamp: n.properties.timestamp.toNumber(),
            sessionId: n.properties.sessionId,
          });
          seenNodeIds.add(nodeId);
        }

        const related = record.get('related') || [];
        for (const rel of related) {
          if (rel.edge && rel.node) {
            const edgeKey = `${nodeId}-${rel.edge.type}-${rel.node.properties.id}`;
            if (!seenEdgeKeys.has(edgeKey)) {
              edges.push({
                from: nodeId,
                to: rel.node.properties.id,
                type: rel.edge.type.toLowerCase() as MemoryEdge['type'],
                weight: rel.edge.properties?.weight?.toNumber() || 1.0,
              });
              seenEdgeKeys.add(edgeKey);
            }
          }
        }
      }

      return {
        nodes,
        edges,
        relevanceScore: nodes.length > 0 ? 1.0 : 0,
      };
    } catch (error) {
      console.error('Failed to query memories:', error);
      return { nodes: [], edges: [], relevanceScore: 0 };
    } finally {
      await session.close();
    }
  }

  async getRecentMemories(limit: number = 20, sessionId?: string): Promise<MemoryNode[]> {
    if (!this.connected || !this.driver) return [];

    const session = this.driver.session();
    try {
      const sessionFilter = sessionId
        ? 'WHERE n.sessionId = $sessionId'
        : '';

      const result = await session.run(
        `
        MATCH (n:Memory)
        ${sessionFilter}
        RETURN n
        ORDER BY n.timestamp DESC
        LIMIT $limit
        `,
        { limit, sessionId }
      );

      return result.records.map(record => {
        const n = record.get('n').properties;
        return {
          id: n.id,
          type: n.type,
          content: n.content,
          metadata: n.metadata,
          timestamp: n.timestamp.toNumber(),
          sessionId: n.sessionId,
        };
      });
    } catch (error) {
      console.error('Failed to get recent memories:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    if (!this.connected || !this.driver) return;

    const session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (n:Memory {sessionId: $sessionId})
        DETACH DELETE n
        `,
        { sessionId }
      );
      console.log(`✓ Cleared session: ${sessionId}`);
    } catch (error) {
      console.error('Failed to clear session:', error);
    } finally {
      await session.close();
    }
  }

  async getSessionStats(): Promise<{ nodeCount: number; edgeCount: number }> {
    if (!this.connected || !this.driver) {
      return { nodeCount: 0, edgeCount: 0 };
    }

    const session = this.driver.session();
    try {
      const nodeResult = await session.run('MATCH (n:Memory) RETURN count(n) as count');
      const edgeResult = await session.run('MATCH ()-[r]->() RETURN count(r) as count');

      return {
        nodeCount: nodeResult.records[0]?.get('count')?.toNumber() || 0,
        edgeCount: edgeResult.records[0]?.get('count')?.toNumber() || 0,
      };
    } finally {
      await session.close();
    }
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
let graphitiClient: GraphitiClient | null = null;

export function getGraphitiClient(): GraphitiClient {
  if (!graphitiClient) {
    graphitiClient = new GraphitiClient();
  }
  return graphitiClient;
}

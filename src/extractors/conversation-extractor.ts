/**
 * Conversation Extractor
 * 
 * Extracts knowledge from user_conversation evidence.
 * 
 * Extraction Rules:
 * 1. Topic entities from messages
 * 2. Decision patterns (decided, chose, selected)
 * 3. Technology mentions (frameworks, libraries, tools)
 * 4. Action items (TODO, FIXME, should, need to)
 */

import { Evidence } from '../types/knowledge';
import { NewKnowledge } from '../types/knowledge-extraction';
import { KnowledgeExtractor } from '../types/extractors';

export class ConversationExtractor implements KnowledgeExtractor {
  
  supports(evidenceType: string): boolean {
    return evidenceType === 'user_conversation';
  }
  
  extract(evidence: Evidence): NewKnowledge[] {
    const knowledge: NewKnowledge[] = [];
    
    try {
      const content = evidence.content;
      const role = content.role || 'unknown';
      const message = content.message || '';
      const turnIndex = content.turnIndex;
      const conversationTitle = content.conversationTitle || 'Untitled';
      
      // Skip very short messages
      if (message.length < 10) {
        return [];
      }
      
      // 1. Extract technology mentions
      const techMentions = this.extractTechnologies(message);
      for (const tech of techMentions) {
        knowledge.push({
          evidenceId: evidence.id,
          type: 'fact',
          subject: `conversation:${turnIndex}`,
          predicate: 'mentions_technology',
          object: tech,
          confidence: 0.8,
          extractorName: 'conversation-extractor',
          extractorVersion: 1
        });
      }
      
      // 2. Extract decision patterns
      const decisionPatterns = [
        /(?:we |let's |i )?(?:should |need to |will )?(?:use|choose|select|adopt|go with) (.+?)(?:\.|,|instead|over|$)/gi,
        /(?:decided|chose|selected) (.+?)(?:\.|,|$)/gi,
        /(?:the solution is|the fix is|the answer is) (.+?)(?:\.|,|$)/gi
      ];
      
      for (const pattern of decisionPatterns) {
        const matches = message.matchAll(pattern);
        for (const match of matches) {
          const decision = match[1].trim();
          if (decision.length > 5 && decision.length < 200) {
            knowledge.push({
              evidenceId: evidence.id,
              type: 'fact',
              subject: `conversation:${turnIndex}`,
              predicate: 'decided',
              object: decision,
              confidence: 0.85,
              extractorName: 'conversation-extractor',
              extractorVersion: 1
            });
          }
        }
      }
      
      // 3. Extract problem-solution patterns
      const problemPatterns = [
        /(?:problem|issue|error|bug|failure) is (.+?)(?:\.|,|because|since|$)/gi,
        /(?:failing|erroring|not working) because (.+?)(?:\.|,|$)/gi
      ];
      
      for (const pattern of problemPatterns) {
        const matches = message.matchAll(pattern);
        for (const match of matches) {
          const problem = match[1].trim();
          if (problem.length > 5 && problem.length < 200) {
            knowledge.push({
              evidenceId: evidence.id,
              type: 'fact',
              subject: `conversation:${turnIndex}`,
              predicate: 'problem_identified',
              object: problem,
              confidence: 0.75,
              extractorName: 'conversation-extractor',
              extractorVersion: 1
            });
          }
        }
      }
      
      // 4. Add conversation turn fact
      knowledge.push({
        evidenceId: evidence.id,
        type: 'fact',
        subject: conversationTitle,
        predicate: 'has_turn',
        object: `turn:${turnIndex}:${role}`,
        confidence: 0.9,
        extractorName: 'conversation-extractor',
        extractorVersion: 1
      });
      
    } catch (error) {
      console.error('ConversationExtractor error:', error);
    }
    
    return knowledge;
  }
  
  /**
   * Extract technology mentions from text
   */
  private extractTechnologies(text: string): string[] {
    const technologies: string[] = [];
    const techPatterns = [
      // Languages
      /\b(typescript|javascript|python|go|rust|java|kotlin|swift)\b/gi,
      // Frameworks
      /\b(react|vue|angular|express|fastify|next\.js|nuxt|gatsby)\b/gi,
      // Databases
      /\b(postgres|mysql|mongodb|redis|neo4j|dynamodb|elasticsearch)\b/gi,
      // Tools
      /\b(docker|kubernetes|terraform|ansible|nginx|webpack|vite)\b/gi,
      // Cloud
      /\b(aws|azure|gcp|vercel|netlify|heroku)\b/gi,
      // Libraries
      /\b(jest|cypress|playwright|prisma|typeorm|sequelize|graphql)\b/gi
    ];
    
    const seen = new Set<string>();
    
    for (const pattern of techPatterns) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        const normalized = match.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          technologies.push(normalized);
        }
      }
    }
    
    return technologies;
  }
}

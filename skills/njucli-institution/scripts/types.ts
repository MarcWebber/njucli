export interface KnowledgeSource {
  url: string;
  fetchedAt: string;
  selector?: string;
}

export interface Institution {
  id: string;
  name: string;
  category: string;
  parentId?: string;
  url?: string;
  source: KnowledgeSource;
}

export type KnowledgeKind = "overview" | "teacher";

export interface KnowledgeRecord {
  id: string;
  institutionId: string;
  kind: KnowledgeKind;
  title: string;
  text: string;
  source: KnowledgeSource;
  category?: string;
  department?: string;
  role?: string;
  phone?: string;
  email?: string;
  office?: string;
}

export interface LogisticsService {
  unit: string;
  department: string;
  phone: string;
  source: KnowledgeSource;
}

export interface InstitutionCoverage {
  institutionId: string;
  notes: string[];
  rosterSource?: KnowledgeSource;
}

export interface InstitutionSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  institutions: Institution[];
  records: KnowledgeRecord[];
  services: LogisticsService[];
  coverage: InstitutionCoverage[];
}

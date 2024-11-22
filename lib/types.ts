export interface DatabaseTable {
  columns: string[];
  data: (string | number)[][];
}

export interface DatabaseStructure {
  databases: {
    [key: string]: {
      tables: {
        [key: string]: DatabaseTable;
      };
    };
  };
}

export interface ParsedQuery {
  type: string;
  originalCommand: string;
  columns?: string[];
  table?: string;
  alias?: { [key: string]: string };
  joins?: JoinClause[];
  where?: WhereCondition | null;
  groupBy?: string[];
  having?: WhereCondition | null;
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
  errorToken?: string;
  message?: string;
  database?: string;
  filename?: string;
}

export interface WhereCondition {
  column: string;
  operator: string;
  value: string | number;
}

export interface OrderByClause {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface TerminalProps {
  className?: string;
}

export interface TerminalState {
  input: string;
  cursorPosition: number;
  commandHistory: string[];
  historyIndex: number;
  output: string[];
  isAtEnd: boolean;
  currentQuery: string;
}

export type ParsedQueryType = 
  | 'SELECT' 
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'USE_DATABASE' 
  | 'SHOW_DATABASES' 
  | 'LIST_DATABASES'
  | 'SHOW_TABLES'
  | 'LIST_TABLES'
  | 'DESCRIBE_TABLE'
  | 'ERROR'
  | 'EXIT'
  | 'CANCEL'; 

// INSERT文用の型
export interface InsertQuery extends ParsedQuery {
  type: 'INSERT';
  table: string;
  columns: string[];
  values: (string | number)[][];
}

// UPDATE文用の型
export interface UpdateQuery extends ParsedQuery {
  type: 'UPDATE';
  table: string;
  set: { [key: string]: string | number };
  where?: WhereCondition;
}

// CREATE TABLE文用の型
export interface CreateTableQuery extends ParsedQuery {
  type: 'CREATE_TABLE';
  table: string;
  columns: {
    name: string;
    type: string;
    constraints: string[];
  }[];
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table: string;
  alias?: string;
  on: {
    leftColumn: string;
    operator: string;
    rightColumn: string;
  };
}
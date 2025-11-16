// 基本的なテーブル構造の型
export interface Table {
  columns: string[];
  data: (string | number)[][];
}

// データベースの型を動的に生成
export type Tables = {
  [tableName: string]: Table;
}

export interface Database {
  tables: {
    [tableName: string]: DatabaseTable;
  };
}

export interface Databases {
  [dbName: string]: Database;
}

// DatabaseStructureの修正
export interface DatabaseStructure {
  currentDB: string | null;
  data: {
    databases: Databases;
  };
}

// SQLパーサー用の型
export type QueryType = 
  | 'SHOW_DATABASES' 
  | 'SHOW_TABLES' 
  | 'LIST_DATABASES' 
  | 'LIST_TABLES' 
  | 'EXIT' 
  | 'CANCEL'
  | 'SELECT'
  | 'USE_DATABASE'
  | 'DESCRIBE_TABLE'
  | 'ERROR';

export interface ParsedQuery {
  type: QueryType;
  originalCommand: string;
}

export interface SimpleQuery extends ParsedQuery {
  type: 'SHOW_DATABASES' | 'SHOW_TABLES' | 'LIST_DATABASES' | 'LIST_TABLES' | 'EXIT' | 'CANCEL';
}

export interface SelectQuery extends ParsedQuery {
  type: 'SELECT';
  columns: string[];
  table: string;
  where: WhereCondition | null;
  groupBy: string[];
  orderBy: string[];
  limit: number | null;
  offset: number | null;
}

export interface UseDatabaseQuery extends ParsedQuery {
  type: 'USE_DATABASE';
  database: string;
}

export interface DescribeTableQuery extends ParsedQuery {
  type: 'DESCRIBE_TABLE';
  table: string;
}

export interface ErrorQuery extends ParsedQuery {
  type: 'ERROR';
  message: string;
}

export interface WhereCondition {
  column: string;
  operator: string;
  value: string | number;
}

export type AllQueries = 
  | SimpleQuery 
  | SelectQuery 
  | UseDatabaseQuery 
  | DescribeTableQuery 
  | ErrorQuery;

// データベースの型を修正
export interface DatabaseTable {
  columns: string[];
  data?: (string | number)[][];  // dataはオプショナルに
}

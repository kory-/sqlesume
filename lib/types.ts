import alasql from 'alasql';

export interface DatabaseTable {
  columns: string[];
  data: (string | number)[][];
}

export type DatabaseStructure = {
  databases: {
    [dbName: string]: {
      tables: {
        [tableName: string]: DatabaseTable;
      };
    };
  };
};

export type SelectQuery = {
  type: 'SELECT';
  originalCommand: string;
  columns: string[];
  table: string;
  where?: WhereCondition | null;
  groupBy?: string[];
  orderBy?: { column: string; direction: 'ASC' | 'DESC' }[];
  limit?: number | null;
  offset?: number | null;
};

export type CreateTableQuery = {
  type: 'CREATE_TABLE';
  originalCommand: string;
  table: string;
  columns: { name: string; type: string }[];
};

export type DescribeTableQuery = {
  type: 'DESCRIBE_TABLE';
  originalCommand: string;
  table: string;
};

export type UseDatabaseQuery = {
  type: 'USE_DATABASE';
  originalCommand: string;
  database: string;
};

export type SimpleQuery = {
  type: 'SHOW_TABLES' | 'LIST_TABLES' | 'SHOW_DATABASES' | 'LIST_DATABASES' | 'EXIT' | 'CANCEL';
  originalCommand: string;
};

export type ErrorQuery = {
  type: 'ERROR';
  originalCommand: string;
  message?: string;
};

export type InsertQuery = {
  type: 'INSERT';
  originalCommand: string;
  table: string;
  values: any[];
};

export type UpdateQuery = {
  type: 'UPDATE';
  originalCommand: string;
  table: string;
  conditions?: { [key: string]: any };
  updates: { [key: string]: any };
};

export type DeleteQuery = {
  type: 'DELETE';
  originalCommand: string;
  table: string;
  conditions?: { [key: string]: any };
};

export type DropTableQuery = {
  type: 'DROP_TABLE';
  originalCommand: string;
  table: string;
};

export type WhereCondition = {
  column: string;
  operator: '=' | '!=' | '<' | '<=' | '>' | '>='; // 比較演算子
  value: any;
};

export type ParsedQuery =
  | SelectQuery
  | CreateTableQuery
  | DescribeTableQuery
  | UseDatabaseQuery
  | SimpleQuery
  | ErrorQuery
  | InsertQuery
  | UpdateQuery
  | DeleteQuery
  | DropTableQuery;

export class Database {
  data: DatabaseStructure;
  currentDB: string | null;
  lastCommand: string | null;
  onExit?: () => void;

  constructor(data: DatabaseStructure, onExit?: () => void) {
    this.data = data;
    this.currentDB = null;
    this.lastCommand = null;
    this.onExit = onExit;

    this.initializeDatabase();
  }

  private initializeDatabase() {
    try {
      // 既存データベースを削除
      const databases = alasql('SHOW DATABASES');
      databases.forEach((db: { databaseid: string }) => {
        if (db.databaseid !== 'alasql') {
          alasql(`DROP DATABASE IF EXISTS ${db.databaseid}`);
        }
      });

      // データベースとテーブルを作成
      Object.entries(this.data.databases).forEach(([dbName, db]) => {
        alasql(`CREATE DATABASE ${dbName}`);
        alasql(`USE ${dbName}`);
        Object.entries(db.tables).forEach(([tableName, table]) => {
          const columns = table.columns.map(col => `${col} STRING`).join(', ');
          alasql(`CREATE TABLE ${tableName} (${columns})`);
          table.data.forEach(row => {
            const placeholders = table.columns.map(() => '?').join(', ');
            const insertSql = `INSERT INTO ${tableName} VALUES (${placeholders})`;
            alasql(insertSql, row);
          });
        });
      });
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  executeQuery(parsedQuery: ParsedQuery): string {
    this.lastCommand = parsedQuery.originalCommand;
  
    try {
      switch (parsedQuery.type) {
        case 'SHOW_TABLES':
        case 'LIST_TABLES':
          return this.showTables();
  
        case 'SHOW_DATABASES':
        case 'LIST_DATABASES':
          return this.showDatabases();
  
        case 'USE_DATABASE':
          return this.useDatabase(parsedQuery.database);
  
        case 'DESCRIBE_TABLE':
          return this.describeTable(parsedQuery.table);
  
        case 'SELECT':
          if (!this.currentDB) {
            return 'Error: No database selected';
          }
          alasql(`USE ${this.currentDB}`);
          const result = alasql(parsedQuery.originalCommand);
          return this.formatSelectResult(result);
  
        case 'CREATE_TABLE':
          return `Error: CREATE_TABLE is not allowed in read-only mode`;
  
        case 'INSERT':
        case 'UPDATE':
        case 'DELETE':
        case 'DROP_TABLE':
          return `Error: ${parsedQuery.type} operation is not allowed in read-only mode`;
  
        case 'EXIT':
          if (this.onExit) {
            this.onExit();
          }
          return 'Bye';
  
        case 'ERROR':
          if (parsedQuery.message) {
            return parsedQuery.message;
          }
          return 'Unknown error';

      }
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  
    // 保険として戻り値を保証
    return 'Error: Unexpected code path';
  }
  

  private showTables(): string {
    if (!this.currentDB) {
      return 'Error: No database selected';
    }
    const tables = Object.keys(this.data.databases[this.currentDB].tables);
    return `Tables in ${this.currentDB}: ${tables.join(', ')}`;
  }

  private showDatabases(): string {
    const databases = Object.keys(this.data.databases);
    return `Databases: ${databases.join(', ')}`;
  }

  private useDatabase(dbName: string): string {
    if (this.data.databases[dbName]) {
      this.currentDB = dbName;
      alasql(`USE ${dbName}`);
      return `Database changed to ${dbName}`;
    }
    return `Error: Database "${dbName}" does not exist`;
  }

  private describeTable(tableName: string): string {
    if (!this.currentDB) {
      return 'Error: No database selected';
    }
    const table = this.data.databases[this.currentDB].tables[tableName];
    if (!table) {
      return `Error: Table "${tableName}" does not exist`;
    }
    return `Columns in ${tableName}: ${table.columns.join(', ')}`;
  }

  private formatSelectResult(result: any[]): string {
    if (result.length === 0) {
      return '(0 rows)';
    }
    const columns = Object.keys(result[0]);
    const rows = result.map(row => columns.map(col => row[col]).join(' | '));
    return `Columns: ${columns.join(' | ')}\n${rows.join('\n')}`;
  }
}

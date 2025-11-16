import { ParsedQuery, SimpleQuery, SelectQuery, UseDatabaseQuery, DescribeTableQuery, WhereCondition, ErrorQuery } from './types';
import { Database } from './database';

export class SQLParser {
  static getCompletions(query: string, db: Database): string[] {
    const lastWord = query.slice(0, query.length).split(/\s+/).pop()?.toLowerCase() || '';
    
    // キーワードリストを拡充
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT',
      'USE', 'SHOW', 'DESCRIBE', 'TABLES', 'DATABASES', 'EXIT',
      'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ON',
      'AND', 'OR', 'NOT', 'IN', 'LIKE', 'IS NULL', 'IS NOT NULL',
      'ASC', 'DESC', 'HAVING'
    ];

    // コマンドの文脈を判断
    const queryContext = query.toLowerCase().trim();
    
    // データベース名の補完
    if (queryContext.startsWith('use ') || queryContext.startsWith('\\c ')) {
      return Object.keys(db.data.databases)
        .filter(dbName => dbName.toLowerCase().startsWith(lastWord));
    }

    if (!db.currentDB) return [];
    
    // 現在のクエリで参照されているテーブルを取得
    const tableAliases = new Map<string, string>();
    const tableNames = new Set<string>();
    
    // FROM句とJOIN句からテーブル情報を抽出
    const fromMatch = queryContext.match(/from\s+(\w+)(?:\s+as\s+(\w+))?/);
    if (fromMatch) {
      const [, tableName, alias] = fromMatch;
      tableNames.add(tableName);
      if (alias) tableAliases.set(alias, tableName);
    }
    
    const joinMatches = queryContext.matchAll(/join\s+(\w+)(?:\s+as\s+(\w+))?/g);
    for (const match of joinMatches) {
      const [, tableName, alias] = match;
      tableNames.add(tableName);
      if (alias) tableAliases.set(alias, tableName);
    }

    // 利用可能なカラムを収集
    const getAvailableColumns = () => {
      const columns = new Set<string>();
      if (db.currentDB) {
        const currentDatabase = db.data.databases[db.currentDB];
        if (currentDatabase) {
          for (const tableName of tableNames) {
            const table = currentDatabase.tables[tableName];
            if (table) {
              table.columns.forEach(col => columns.add(col));
            }
          }
        }
      }
      return Array.from(columns);
    };

    // テーブル名の補完（FROM句やJOIN句の後）
    if (/(from|join)\s+\w*$/.test(queryContext)) {
      return Object.keys(db.data.databases[db?.currentDB].tables)
        .filter(tableName => tableName.toLowerCase().startsWith(lastWord));
    }

    // WHERE句のカラム名補完を修正
    if (/where(?:\s+\w+\s+(?:=|!=|<|<=|>|>=|like|in)\s+(?:'[^']*'|\d+|\([^\)]*\)))*(?:\s+(?:and|or)\s+)*\s*\w*$/.test(queryContext)) {
      return getAvailableColumns()
        .filter(colName => colName.toLowerCase().startsWith(lastWord));
    }

    // JOIN ON句のカラム名補完
    if (/on\s+\w*$/.test(queryContext) ||
        /on\s+\w+\s*=\s*\w*$/.test(queryContext)) {
      return getAvailableColumns()
        .filter(colName => colName.toLowerCase().startsWith(lastWord));
    }

    // GROUP BY句のカラム名補完
    if (/group\s+by\s+\w*$/.test(queryContext) ||
        /group\s+by\s+.*,\s*\w*$/.test(queryContext)) {
      return getAvailableColumns()
        .filter(colName => colName.toLowerCase().startsWith(lastWord));
    }

    // ORDER BY句のカラム名補完
    if (/order\s+by\s+\w*$/.test(queryContext) ||
        /order\s+by\s+.*,\s*\w*$/.test(queryContext)) {
      return getAvailableColumns()
        .filter(colName => colName.toLowerCase().startsWith(lastWord));
    }

    // HAVING句のカラム名補完
    if (/having\s+\w*$/.test(queryContext)) {
      return getAvailableColumns()
        .filter(colName => colName.toLowerCase().startsWith(lastWord));
    }

    // SELECT句のカラム名補完
    if (queryContext.startsWith('select ')) {
      if (tableNames.size > 0) {
        return getAvailableColumns()
          .filter(colName => colName.toLowerCase().startsWith(lastWord));
      }
      // FROM句がまだない場合は、現在のデータベースの全テーブルのカラムを候補に
      return Object.values(db.data.databases[db.currentDB].tables)
        .flatMap(table => table.columns)
        .filter((colName, index, self) => 
          self.indexOf(colName) === index && 
          colName.toLowerCase().startsWith(lastWord)
        );
    }

    // キーワードの補完
    return keywords.filter(keyword => 
      keyword.toLowerCase().startsWith(lastWord)
    );
  }

  static parse(query: string): ParsedQuery | null {
    query = query.trim();
    const lowerQuery = query.toLowerCase();

    // エラー処理用のベース結果
    const errorQuery: ErrorQuery = {
      type: 'ERROR',
      originalCommand: query,
      message: 'syntax error at or near "' + lowerQuery.split(/\s+/)[0] + '"'
    };

    // PostgreSQLコマンド解析
    if (query.startsWith('\\')) {
      const parts = query.split(/\s+/);
      const command = parts[0].slice(1);

      switch (command) {
        case 'l':
          return { type: 'LIST_DATABASES', originalCommand: query };
        case 'dt':
          return { type: 'LIST_TABLES', originalCommand: query };
        case 'd':
          if (parts.length > 1) {
            return { 
              type: 'DESCRIBE_TABLE', 
              originalCommand: query, 
              table: parts[1] 
            } as DescribeTableQuery;
          }
          return { type: 'LIST_TABLES', originalCommand: query };
        case 'c':
          if (parts.length > 1) {
            return { 
              type: 'USE_DATABASE', 
              originalCommand: query, 
              database: parts[1].replace(/;$/, '') 
            } as UseDatabaseQuery;
          }
          return errorQuery;
        case 'q':
          return { type: 'EXIT', originalCommand: query };
        default:
          return errorQuery;
      }
    }

    // その他のクエリ解析
    if (lowerQuery.startsWith('select')) {
      return this.parseSelect(query);
    }
    if (lowerQuery === 'show databases;') {
      return { type: 'SHOW_DATABASES', originalCommand: query };
    }
    if (lowerQuery === 'show tables;') {
      return { type: 'SHOW_TABLES', originalCommand: query };
    }
    if (lowerQuery.startsWith('use ')) {
      const dbName = query.split(/\s+/)[1]?.replace(/;$/, '');
      if (dbName) {
        return { 
          type: 'USE_DATABASE', 
          originalCommand: query,
          database: dbName 
        } as UseDatabaseQuery;
      }
    }
    if (lowerQuery === 'exit' || lowerQuery === 'exit;') {
      return { type: 'EXIT', originalCommand: query };
    }
    return errorQuery;
  }

  private static parseSelect(query: string): SelectQuery {
    query = query.replace(/;$/, ''); // セミコロンを除去

    const result: SelectQuery = {
      type: 'SELECT',
      originalCommand: query,
      columns: [],
      table: '',
      where: null,
      groupBy: [],
      orderBy: [],
      limit: null,
      offset: null
    };

    // LIMIT句の解析
    const limitMatch = query.match(/\blimit\s+(\d+)$/i);
    if (limitMatch) {
      result.limit = parseInt(limitMatch[1]);
    }

    // SELECTとFROM句の解析
    const selectMatch = query.match(/select\s+(.+?)\s+from\s+(\w+)/i);
    if (selectMatch) {
      result.columns = selectMatch[1].split(',').map(col => col.trim());
      result.table = selectMatch[2];
    }

    return result;
  }
}

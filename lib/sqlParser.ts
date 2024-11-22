import { ParsedQuery, WhereCondition, OrderByClause } from './types';
import { Database } from './database';

export class SQLParser {
  static parse(query: string): ParsedQuery | null {
    query = query.trim();
    const lowerQuery = query.toLowerCase();
    
    const baseResult = {
      originalCommand: query
    };
    
    // PostgreSQLコマンドの解析
    if (query.startsWith('\\')) {
      query = query.replace(/;$/, '');
      const parts = query.split(/\s+/);
      const command = parts[0].slice(1);
      
      switch (command) {
        case 'l':
          return {
            ...baseResult,
            type: 'LIST_DATABASES'
          };
        case 'dt':
          return {
            ...baseResult,
            type: 'LIST_TABLES'
          };
        case 'd':
          if (parts.length > 1) {
            return {
              ...baseResult,
              type: 'DESCRIBE_TABLE',
              table: parts[1]
            };
          } else {
            return {
              ...baseResult,
              type: 'LIST_TABLES'
            };
          }
        case 'c':
          if (parts.length > 1) {
            return {
              ...baseResult,
              type: 'USE_DATABASE',
              database: parts[1]
            };
          }
          return null;
        case 'q':
          return {
            ...baseResult,
            type: 'EXIT'
          };
      }
      return null;
    }
    
    // DESCRIBEコマンドの解析を修正
    const describeMatch = lowerQuery.match(/^(?:describe|desc)\s+([a-zA-Z_][a-zA-Z0-9_]*);$/i);
    if (describeMatch) {
      return {
        ...baseResult,
        type: 'DESCRIBE_TABLE',
        table: describeMatch[1]
      };
    }

    // SHOW COLUMNS コマンドの解析を追加
    const showColumnsMatch = lowerQuery.match(/^show\s+columns\s+(?:from\s+)?([a-zA-Z_][a-zA-Z0-9_]*);$/i);
    if (showColumnsMatch) {
      return {
        ...baseResult,
        type: 'DESCRIBE_TABLE',
        table: showColumnsMatch[1]
      };
    }

    // 単独のセミコロンの場合、直前のコマンドの続きとして処理
    if (lowerQuery === ';') {
      const lastCommand = this.getLastIncompleteCommand();
      if (lastCommand) {
        return this.parse(lastCommand + ';');
      }
    }

    // USE文の解析を修正
    const useMatch = lowerQuery.match(/^use\s+(\w+)$/);
    if (useMatch) {
      this.lastIncompleteCommand = query;
      return null;  // セミコロンを待つ
    }

    // 完全なUSE文の解析
    const completeUseMatch = lowerQuery.match(/^use\s+(\w+);$/);
    if (completeUseMatch) {
      return {
        ...baseResult,
        type: 'USE_DATABASE',
        database: completeUseMatch[1]
      };
    }

    // セミコロンがない場合
    if (!query.endsWith(';')) {
      return this.handleIncompleteCommand(query, lowerQuery.split(/\s+/)[0]);
    }

    // MySQLコマンドの解析
    if (lowerQuery === 'show databases;') {
      return {
        ...baseResult,
        type: 'SHOW_DATABASES'
      };
    }
    
    if (lowerQuery === 'show tables;') {
      return {
        ...baseResult,
        type: 'SHOW_TABLES'
      };
    }

    // SELECT文の解析
    if (lowerQuery.startsWith('select')) {
      return this.parseSelect(query);
    }

    return {
      ...baseResult,
      type: 'ERROR',
      errorToken: lowerQuery.split(/\s+/)[0],
      message: 'syntax error at or near "' + lowerQuery.split(/\s+/)[0] + '"'
    };
  }

  private static parseSelect(query: string): ParsedQuery {
    const result: ParsedQuery = {
      type: 'SELECT',
      originalCommand: query,
      columns: [],
      table: '',
      where: null,
      groupBy: [],
      orderBy: [],
      limit: null
    };

    // セミコロンを除去
    query = query.replace(/;$/, '');

    // LIMITの解析
    const limitMatch = query.match(/\blimit\s+(\d+)$/i);
    if (limitMatch) {
      result.limit = parseInt(limitMatch[1]);
      query = query.replace(/\blimit\s+\d+$/i, '');
    }

    // ORDER BYの解析
    const orderByMatch = query.match(/\border by\s+(.+?)(?=\s+limit|\s*$)/i);
    if (orderByMatch) {
      result.orderBy = orderByMatch[1].split(',').map(item => {
        const [col, dir] = item.trim().split(/\s+/);
        return { column: col, direction: (dir?.toUpperCase() || 'ASC') as 'ASC' | 'DESC' };
      });
      query = query.replace(/\border by\s+.+?(?=\s+limit|\s*$)/i, '');
    }

    // GROUP BYの解析
    const groupByMatch = query.match(/\bgroup by\s+(.+?)(?=\s+order|\s+limit|\s*$)/i);
    if (groupByMatch) {
      result.groupBy = groupByMatch[1].split(',').map(col => col.trim());
      query = query.replace(/\bgroup by\s+.+?(?=\s+order|\s+limit|\s*$)/i, '');
    }

    // WHEREの解析
    const whereMatch = query.match(/\bwhere\s+(.+?)(?=\s+group|\s+order|\s+limit|\s*$)/i);
    if (whereMatch) {
      result.where = this.parseWhereCondition(whereMatch[1]);
      query = query.replace(/\bwhere\s+.+?(?=\s+group|\s+order|\s+limit|\s*$)/i, '');
    }

    // SELECT と FROM の解析
    const basicMatch = query.match(/select\s+(.+?)\s+from\s+(\w+)/i);
    if (basicMatch) {
      result.columns = basicMatch[1].split(',').map(col => col.trim());
      result.table = basicMatch[2];
    }

    return result;
  }

  private static parseWhereCondition(whereClause: string): WhereCondition | null {
    const operatorPattern = /([^<>=!]+)\s*(=|!=|>|<|>=|<=|LIKE)\s*('[^']*'|"[^"]*"|\d+)/i;
    const match = whereClause.match(operatorPattern);
    
    if (match) {
      const [_, column, operator, value] = match;
      return {
        column: column.trim(),
        operator: operator.toUpperCase(),
        value: this.parseValue(value.trim())
      };
    }
    return null;
  }

  private static parseValue(value: string): string | number {
    if (!isNaN(Number(value))) {
      return Number(value);
    }
    if ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))) {
      return value.slice(1, -1);
    }
    return value;
  }

  static getCompletions(query: string, db: Database): string[] {
    const lastWord = query.split(/\s+/).pop()?.toLowerCase() || '';
    const queryLower = query.toLowerCase();

    const keywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'JOIN', 'ON', 'AND', 'OR'];
    const pgCommands = ['\\l', '\\dt', '\\d', '\\c'];
    
    if (query.startsWith('\\')) {
      if (!query.includes(' ')) {
        return pgCommands.filter(cmd => cmd.startsWith(lastWord));
      }
      
      const parts = query.split(/\s+/);
      const command = parts[0];
      
      if (command === '\\c') {
        return Object.keys(db.data.databases)
          .filter(dbName => dbName.toLowerCase().startsWith(lastWord));
      }
      
      if (command === '\\d' && db.currentDB) {
        const tables = Object.keys(db.data.databases[db.currentDB].tables);
        return tables.filter(t => t.toLowerCase().startsWith(lastWord));
      }
    }

    if (queryLower.startsWith('use ')) {
      return Object.keys(db.data.databases)
        .filter(dbName => dbName.toLowerCase().startsWith(lastWord));
    }

    if (!db.currentDB) return [];

    // テーブルの別名を収集
    const tableAliases = new Map<string, string>();
    const fromMatch = queryLower.match(/from\s+(\w+)(?:\s+as\s+)?(\w+)?/);
    if (fromMatch) {
      const [_, tableName, alias] = fromMatch;
      if (alias) {
        tableAliases.set(alias, tableName);
      } else {
        tableAliases.set(tableName, tableName);
      }
    }

    // JOINで使用されているテーブルの別名を収集
    const joinRegex = /join\s+(\w+)(?:\s+as\s+)?(\w+)?/g;
    let joinMatch;
    while ((joinMatch = joinRegex.exec(queryLower)) !== null) {
      const [_, tableName, alias] = joinMatch;
      if (alias) {
        tableAliases.set(alias, tableName);
      } else {
        tableAliases.set(tableName, tableName);
      }
    }

    // WHERE句やJOINのON句の後のカラム名の補完
    const beforeWord = query.split(/\s+/).slice(-2, -1)[0]?.toLowerCase();
    if (beforeWord === 'where' || beforeWord === 'and' || beforeWord === 'or' || beforeWord === 'on') {
      const suggestions: string[] = [];
      
      // 別名付きのカラム名を収集
      tableAliases.forEach((tableName, alias) => {
        const table = db.data.databases[db.currentDB!].tables[tableName];
        if (table) {
          suggestions.push(...table.columns.map(col => `${alias}.${col}`));
        }
      });

      return suggestions.filter(col => col.toLowerCase().startsWith(lastWord));
    }

    // テーブル別名の後のカラム名の補完
    const aliasPrefix = lastWord.split('.');
    if (aliasPrefix.length === 2) {
      const [alias, colPrefix] = aliasPrefix;
      const tableName = tableAliases.get(alias);
      if (tableName) {
        const table = db.data.databases[db.currentDB].tables[tableName];
        if (table) {
          return table.columns
            .filter(col => col.toLowerCase().startsWith(colPrefix))
            .map(col => `${alias}.${col}`);
        }
      }
    }

    // FROM句の後のテーブル名の補完
    if (queryLower.includes('from ')) {
      const tables = Object.keys(db.data.databases[db.currentDB].tables);
      return tables.filter(t => t.toLowerCase().startsWith(lastWord));
    }

    // SELECTの後のカラム名の補完
    if (queryLower.startsWith('select ')) {
      if (fromMatch) {
        const suggestions: string[] = [];
        tableAliases.forEach((tableName, alias) => {
          const table = db.data.databases[db.currentDB!].tables[tableName];
          if (table) {
            suggestions.push(...table.columns.map(col => `${alias}.${col}`));
          }
        });
        return suggestions.filter(col => col.toLowerCase().startsWith(lastWord));
      }
      return keywords.filter(k => k.toLowerCase().startsWith(lastWord));
    }

    return [];
  }

  // 未完了のコマンドを保持する静的変数
  private static lastIncompleteCommand: string | null = null;

  // 未完了のコマンドを取得・クリアするメソッド
  private static getLastIncompleteCommand(): string | null {
    const command = this.lastIncompleteCommand;
    this.lastIncompleteCommand = null;
    return command;
  }

  // セミコロンがない場合の処理を修正
  private static handleIncompleteCommand(query: string, firstWord: string): ParsedQuery | null {
    const sqlCommands = ['select', 'use', 'show', 'describe', 'desc'];
    if (sqlCommands.includes(firstWord)) {
      this.lastIncompleteCommand = query;
      return null;  // SQL入力途中
    }
    
    return {
      type: 'ERROR',
      originalCommand: query,
      errorToken: firstWord,
      message: 'syntax error at or near "' + firstWord + '"'
    };
  }
} 
import alasql from 'alasql';
import { DatabaseStructure, ParsedQuery } from './types';

export class Database {
  data: DatabaseStructure;
  currentDB: string | null;
  files: string[];
  imagePaths: { [key: string]: string };
  lastCommand: string | null;
  onExit?: () => void;

  constructor(data: DatabaseStructure, onExit?: () => void) {
    this.data = data;
    this.currentDB = null;
    this.files = ['secret.png', 'profile.png'];
    this.imagePaths = {
      'secret.png': '',
      'profile.png': ''
    };
    this.lastCommand = null;
    this.onExit = onExit;

    // alasqlの初期化
    this.initializeDatabase();
  }

  private initializeDatabase() {
    try {
      // 既存のデータベースをクリア
      try {
        // 既存のデータベースを一旦全て削除
        const databases = alasql('SHOW DATABASES');
        databases.forEach((db: { databaseid: string }) => {
          if (db.databaseid !== 'alasql') { // alasqlシステムDBは削除しない
            alasql(`DROP DATABASE IF EXISTS ${db.databaseid}`);
          }
        });
      } catch (e) {
        console.warn('Error clearing existing databases:', e);
      }

      // データベースごとの初期化
      Object.entries(this.data.databases).forEach(([dbName, db]) => {
        try {
          alasql(`CREATE DATABASE ${dbName}`);
          alasql(`USE ${dbName}`);
          
          // 各テーブルの作成とデータ投入
          Object.entries(db.tables).forEach(([tableName, table]) => {
            try {
              // テーブルが存在する場合は削除
              alasql(`DROP TABLE IF EXISTS ${tableName}`);
              
              // カラムの定義を作成
              const columns = table.columns.map(col => `${col} STRING`).join(', ');
              alasql(`CREATE TABLE ${tableName} (${columns})`);
              
              // データの投入
              if (table.data.length > 0) {
                const placeholders = table.columns.map(() => '?').join(', ');
                const insertSql = `INSERT INTO ${tableName} VALUES (${placeholders})`;
                table.data.forEach(row => {
                  alasql(insertSql, row);
                });
              }
            } catch (tableError) {
              console.error(`Error creating table ${tableName}:`, tableError);
            }
          });
        } catch (dbError) {
          console.error(`Error creating database ${dbName}:`, dbError);
        }
      });

    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  formatError(message: string, line: number, position: string): string {
    if (this.lastCommand?.startsWith('\\')) {
      return `ERROR:  ${message}\n行 ${line}: ${position}`;
    }
    return message;
  }

  showDatabases(): string {
    const databases = Object.keys(this.data.databases);
    
    if (this.lastCommand?.startsWith('\\')) {
      let result = '                                  List of databases\n';
      result += '    Name    | Owner | Encoding |   Collate   |    Ctype    | Access privileges\n';
      result += '-----------+-------+----------+-------------+-------------+-------------------\n';
      databases.forEach(db => {
        result += ` ${db.padEnd(10)}| user  | UTF8     | en_US.UTF-8 | en_US.UTF-8 | \n`;
      });
      return result;
    }
    
    let result = '+-------------+\n';
    result += '| Database    |\n';
    result += '+-------------+\n';
    databases.forEach(db => {
      result += `| ${db.padEnd(11)} |\n`;
    });
    result += '+-------------+\n';
    return result;
  }

  showTables(): string {
    if (!this.currentDB) {
      return 'Error: No database selected.';
    }

    try {
      // alasqlのSHOW TABLESの結果を取得
      const tables = Object.keys(this.data.databases[this.currentDB].tables);
      
      if (this.lastCommand?.startsWith('\\')) {
        let result = '             List of relations\n';
        result += ' Schema |     Name      | Type  | Owner\n';
        result += '--------+--------------+-------+-------\n';
        tables.forEach(table => {
          result += ` public | ${table.padEnd(12)} | table | user\n`;
        });
        return result;
      }
      
      const title = `Tables_in_${this.currentDB}`;
      const maxLength = Math.max(
        title.length,
        ...tables.map(t => t.length)
      );
      const width = maxLength + 4;

      let result = '+' + '-'.repeat(width) + '+\n';
      result += '| ' + title.padEnd(width - 2) + ' |\n';
      result += '+' + '-'.repeat(width) + '+\n';
      tables.forEach(table => {
        result += '| ' + table.padEnd(width - 2) + ' |\n';
      });
      result += '+' + '-'.repeat(width) + '+\n';
      
      return result;
    } catch (error) {
      console.error('Error in showTables:', error);
      return 'Error: Failed to list tables';
    }
  }

  describeTable(tableName: string): string {
    if (!this.currentDB) {
      return 'Error: No database selected';
    }

    try {
      // データ構造から直接テーブル情報を取得
      const table = this.data.databases[this.currentDB].tables[tableName];
      if (!table) {
        return `Error: Table "${tableName}" not found`;
      }
      
      let result = `                                Table "${this.currentDB}.public.${tableName}"\n`;
      result += ' Column              | Type                        | Collation | Nullable | Default\n';
      result += '--------------------+----------------------------+-----------+----------+---------\n';

      // カラム情報を表示
      table.columns.forEach(col => {
        const colName = col.padEnd(19);
        const typeInfo = 'text'.padEnd(27); // 今回はすべてtextとして扱う
        result += ` ${colName}| ${typeInfo}|           | not null | \n`;
      });

      return result;
    } catch (error) {
      console.error('Error in describeTable:', error);
      return `Error: Failed to describe table "${tableName}"`;
    }
  }

  useDatabase(dbName: string): string {
    if (this.data.databases[dbName]) {
      try {
        alasql(`USE ${dbName}`);
        this.currentDB = dbName;
        
        if (this.lastCommand?.startsWith('\\')) {
          return `You are now connected to database "${dbName}" as user "user"`;
        }
        
        return `Database changed to ${dbName}`;
      } catch (error) {
        return `Error: Could not switch to database "${dbName}"`;
      }
    }
    return `Error: Database "${dbName}" does not exist`;
  }

  executeQuery(parsedQuery: ParsedQuery): string {
    this.lastCommand = parsedQuery.originalCommand;

    if (parsedQuery.type === 'CANCEL') {
      return '^C';
    }

    if (parsedQuery.type === 'ERROR') {
      return this.formatError(
        parsedQuery.message || 'Unknown error',
        1,
        parsedQuery.errorToken || ''
      );
    }

    try {
      switch (parsedQuery.type) {
        case 'SHOW_TABLES':
        case 'LIST_TABLES':
          return this.showTables();
        case 'SELECT':
          if (!this.currentDB) {
            return 'Error: No database selected';
          }
          try {
            // 現在のデータベースを使用するように設定
            alasql(`USE ${this.currentDB}`);
            const result = alasql(parsedQuery.originalCommand);
            return this.formatSelectResult(result);
          } catch (error: any) {
            return `Error: ${error.message}`;
          }
        case 'USE_DATABASE':
          return this.useDatabase(parsedQuery.database || '');
        case 'SHOW_DATABASES':
        case 'LIST_DATABASES':
          return this.showDatabases();
        case 'DESCRIBE_TABLE':
          return this.describeTable(parsedQuery.table || '');
        case 'EXIT':
          if (this.onExit) {
            this.onExit();
          }
          return 'Bye';
        case 'INSERT':
        case 'UPDATE':
        case 'DELETE':
        case 'CREATE_TABLE':
        case 'DROP_TABLE':
          return `Error: ${parsedQuery.type} operation is not allowed in read-only mode`;
        default:
          return `Error: Unknown query type: ${parsedQuery.type}`;
      }
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  private formatSelectResult(result: any[]): string {
    if (!result || result.length === 0) {
      return '(0 rows)';
    }

    // カラム名を取得
    const columns = Object.keys(result[0]);

    // 各カラムの最大幅を計算（全角文字を考慮）
    const columnWidths = columns.map(col => {
      const headerWidth = this.getStringWidth(col);
      const maxDataWidth = result.reduce((max, row) => {
        const value = row[col] === null ? 'NULL' : String(row[col]);
        const cellWidth = this.getStringWidth(value);
        return Math.max(max, cellWidth);
      }, 0);
      return Math.max(headerWidth, maxDataWidth);
    });

    // ヘッダー行を作成
    let output = columns.map((col, i) => 
      this.padString(col, columnWidths[i])
    ).join(' | ');

    // 区切り線を作成
    output += '\n' + columnWidths.map(width => 
      '-'.repeat(width)
    ).join('-+-') + '\n';

    // データ行を作成
    result.forEach(row => {
      output += columns.map((col, i) => {
        const value = row[col] === null ? 'NULL' : String(row[col]);
        return this.padString(value, columnWidths[i]);
      }).join(' | ') + '\n';
    });

    // 行数を追加
    output += `(${result.length} ${result.length === 1 ? 'row' : 'rows'})`;

    return output;
  }

  // 文字列の表示幅を計算（全角文字を考慮）
  private getStringWidth(str: string): number {
    return [...String(str)].reduce((width, char) => {
      // 全角文字かどうかをチェック
      if (
        (char >= '\u4e00' && char <= '\u9fff') || // CJK統合漢字
        (char >= '\u3040' && char <= '\u309f') || // ひらがな
        (char >= '\u30a0' && char <= '\u30ff') || // カタカナ
        (char >= '\uff00' && char <= '\uff9f')    // 全角英数字
      ) {
        return width + 2;
      }
      return width + 1;
    }, 0);
  }

  // 文字列を指定の幅まで埋める（全角文字を考慮）
  private padString(str: string, width: number): string {
    const strWidth = this.getStringWidth(str);
    return str + ' '.repeat(Math.max(0, width - strWidth));
  }

  // ... その他のメソッドは変更なし
} 
class SQLParser {
    static parse(query) {
        query = query.trim();
        const lowerQuery = query.toLowerCase();
        
        const baseResult = {
            originalCommand: query
        };
        
        // PostgreSQLコマンドの解析（セミコロン不要）
        if (query.startsWith('\\')) {
            // セミコロンを含む可能性のある部分を事前に除去
            query = query.replace(/;$/, '');
            const parts = query.split(/\s+/);
            const command = parts[0].slice(1);  // バックスラッシュを除去
            
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
                        // 引数なしの\dの場合はテーブル一覧を表示
                        return {
                            ...baseResult,
                            type: 'LIST_TABLES'
                        };
                    }
                    break;
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
        
        // 通常のSQLコマンドの解析
        const firstWord = lowerQuery.split(/\s+/)[0];
        
        // セミコロンがない場合
        if (!query.endsWith(';')) {
            // SQLコマンドの場合は入力途中と判断
            const sqlCommands = ['select', 'use', 'show', 'insert', 'update', 'delete'];
            if (sqlCommands.includes(firstWord)) {
                return null;  // SQL入力途中
            }
            
            // 不明なコマンドの場合はエラー
            return {
                ...baseResult,
                type: 'ERROR',
                errorToken: firstWord,
                message: 'syntax error at or near "' + firstWord + '"'
            };
        }
        
        // セミコロンがある場合のMySQLコマンドの解析
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

        // USE文の解析
        const useMatch = lowerQuery.match(/^use\s+(\w+);$/);
        if (useMatch) {
            return {
                ...baseResult,
                type: 'USE_DATABASE',
                database: useMatch[1]
            };
        }

        // SELECT文の解析
        if (lowerQuery.startsWith('select')) {
            return this.parseSelect(query);
        }

        // 不明なコマンド（セミコロンあり）の場合はエラー
        return {
            ...baseResult,
            type: 'ERROR',
            errorToken: firstWord,
            message: 'syntax error at or near "' + firstWord + '"'
        };
    }

    static parseSelect(query) {
        const originalQuery = query;
        query = query.toLowerCase();

        const result = {
            type: 'SELECT',
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
                return { column: col, direction: dir?.toUpperCase() || 'ASC' };
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

    static parseWhereCondition(whereClause) {
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

    static parseValue(value) {
        if (!isNaN(value)) {
            return Number(value);
        }
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
            return value.slice(1, -1);
        }
        return value;
    }

    static getCompletions(query, db) {
        const lastWord = query.split(/\s+/).pop().toLowerCase();
        const queryLower = query.toLowerCase();

        // キーワードと特殊コマンドの補完
        const keywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT'];
        const pgCommands = ['\\l', '\\dt', '\\d', '\\c'];
        
        // PostgreSQLコマンドの補完
        if (query.startsWith('\\')) {
            // コマンド自体の補完
            if (!query.includes(' ')) {
                return pgCommands.filter(cmd => cmd.startsWith(lastWord));
            }
            
            // \c や \d の後のデータベース名やテーブル名の補完
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

        // MySQLコマンドの補完
        if (queryLower.startsWith('use ')) {
            return Object.keys(db.data.databases)
                .filter(dbName => dbName.toLowerCase().startsWith(lastWord));
        }

        if (!db.currentDB) return [];

        // テーブル名を取得（FROM句から）
        let tableName = null;
        const fromMatch = queryLower.match(/from\s+(\w+)/);
        if (fromMatch) {
            tableName = fromMatch[1];
        }

        // WHERE句の後のカラム名補完
        if (queryLower.includes('where ') && tableName) {
            const table = db.data.databases[db.currentDB].tables[tableName];
            if (table) {
                // WHERE句の直後のカラム名を補完
                if (queryLower.match(/where\s+$/)) {
                    return table.columns.filter(col => 
                        col.toLowerCase().startsWith(lastWord)
                    );
                }
                // 演算子の後の値は補完しない
                if (!queryLower.match(/[=<>!]+\s*$/)) {
                    return table.columns.filter(col => 
                        col.toLowerCase().startsWith(lastWord)
                    );
                }
            }
        }

        // FROM句の後のテーブル名補完
        if (queryLower.includes('from ')) {
            const tables = Object.keys(db.data.databases[db.currentDB].tables);
            return tables.filter(t => t.toLowerCase().startsWith(lastWord));
        }

        // SELECT句の後のカラム名補完
        if (queryLower.startsWith('select ')) {
            if (tableName) {
                const table = db.data.databases[db.currentDB].tables[tableName];
                if (table) {
                    return table.columns.filter(col => 
                        col.toLowerCase().startsWith(lastWord)
                    );
                }
            }
        }

        return [];
    }
} 
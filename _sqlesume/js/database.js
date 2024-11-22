class Database {
    constructor(data) {
        this.data = data;
        this.currentDB = null;
        this.files = [
            'secret.png',
            'profile.png'
        ];
        this.imagePaths = {
            'secret.png': './images/secret.png',
            'profile.png': './images/profile.png'
        };
        this.lastCommand = null;
    }

    // エラーメッセージを生成するヘルパーメソッド
    formatError(message, line, position) {
        if (this.lastCommand?.startsWith('\\')) {
            // PostgreSQLスタイルのエラー
            return `ERROR:  ${message}\n行 ${line}: ${position}`;
        }
        return message;
    }

    executeQuery(parsedQuery) {
        this.lastCommand = parsedQuery.originalCommand;
        
        if (parsedQuery.type === 'ERROR') {
            return this.formatError(
                'syntax error at or near "' + parsedQuery.errorToken + '"',
                1,
                parsedQuery.errorToken
            );
        }

        // コマンドを記録
        this.lastCommand = parsedQuery.originalCommand;
        
        switch (parsedQuery.type) {
            case 'EXIT':
                this.exitConsole();
                return '';
            case 'ERROR':
                return parsedQuery.message;
            case 'LS':
                return this.listFiles();
            case 'SHOW_DATABASES':
            case 'LIST_DATABASES':
                return this.showDatabases();
            case 'SHOW_TABLES':
            case 'LIST_TABLES':
                return this.showTables();
            case 'SELECT':
                return this.executeSelect(parsedQuery);
            case 'IMGCAT':
            case 'IMG2SIXEL':
                return this.displayImage(parsedQuery.filename);
            case 'DESCRIBE_TABLE':
                return this.describeTable(parsedQuery.table);
            case 'USE_DATABASE':
                return this.useDatabase(parsedQuery.database);
            default:
                return 'Error: Unknown query type';
        }
    }

    exitConsole() {
        document.getElementById('console').style.display = 'none';
        const terminal = document.createElement('div');
        terminal.className = 'terminal';
        terminal.innerHTML = `
            <div id="terminal-output">
            </div>
            <div id="terminal-input-line">
                <span class="prompt-terminal">user@localhost:~$ </span>
                <span id="terminal-current-input"></span>
                <span class="cursor"></span>
            </div>
            <input type="text" id="terminal-input" autocomplete="off">
        `;
        document.body.appendChild(terminal);

        const terminalInput = document.getElementById('terminal-input');
        const terminalCurrentInput = document.getElementById('terminal-current-input');
        const terminalOutput = document.getElementById('terminal-output');
        
        terminalInput.style.position = 'absolute';
        terminalInput.style.left = '-9999px';
        terminalInput.style.width = '1px';
        terminalInput.style.opacity = '0';

        let cursorPosition = 0;
        let commandHistory = ['imgcat profile.png'];  // デフォルトのヒストリー
        let historyIndex = -1;
        
        function updateTerminalDisplay() {
            const value = terminalInput.value;
            terminalCurrentInput.textContent = value;
        }

        function appendTerminalOutput(text) {
            if (text.startsWith('user@localhost:~$')) {
                terminalOutput.innerHTML += `<div>${text}</div>`;
            } else {
                terminalOutput.innerHTML += `<div>${text}</div>`;
            }
            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
            });
        }

        terminalInput.addEventListener('input', (e) => {
            updateTerminalDisplay();
        });

        terminalInput.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    if (historyIndex < commandHistory.length - 1) {
                        historyIndex++;
                        terminalInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
                        updateTerminalDisplay();
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (historyIndex > 0) {
                        historyIndex--;
                        terminalInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
                        updateTerminalDisplay();
                    } else if (historyIndex === 0) {
                        historyIndex = -1;
                        terminalInput.value = '';
                        updateTerminalDisplay();
                    }
                    break;
            }
        });

        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const commandLine = terminalInput.value.trim();
                
                appendTerminalOutput(`user@localhost:~$ ${terminalInput.value}`);
                
                if (commandLine) {
                    // コマンド履歴に追加
                    commandHistory.push(commandLine);
                    historyIndex = -1;

                    const [command, ...args] = commandLine.split(' ');
                    if (command === 'ls') {
                        const options = args.filter(arg => arg.startsWith('-')).join('').replace(/-/g, '');
                        appendTerminalOutput(this.listFiles(options));
                    } else if (command === 'img2sixel' || command === 'imgcat') {
                        if (args.length > 0) {
                            appendTerminalOutput(this.displayImage(args[0]));
                        } else {
                            appendTerminalOutput(`Error: ${command} requires a filename argument`);
                        }
                    } else {
                        appendTerminalOutput(`command not found: ${command}`);
                    }
                }
                
                terminalInput.value = '';
                updateTerminalDisplay();
            }
        });

        terminalInput.focus();
        document.addEventListener('click', () => {
            terminalInput.focus();
        });

        window.scrollTo({
            top: 100,
            behavior: 'auto'
        });
    }

    listFiles(options = '') {
        const showAll = options.includes('a');
        const showList = options.includes('l');
        const showHuman = options.includes('h');

        let files = [...this.files];
        if (showAll) {
            files = ['.', '..', ...files];
        }

        if (showList) {
            let result = '<pre style="font-size: 16px;">total 456\n';
            
            // 各カラムの固定幅を設定
            const format = {
                perms: 10,    // -rw-r--r--
                links: 2,     // 1
                owner: 6,     // user
                group: 6,     // user
                size: 8,      // ファイルサイズ
                date: 12,     // Nov 19 11:34
            };

            const fileSizes = {
                '.': 4096,
                '..': 4096,
                'secret.png': 245760,    // 240KB
                'profile.png': 153600    // 150KB
            };
            
            result += files.map(file => {
                const isDirectory = file === '.' || file === '..';
                const perms = isDirectory ? 'drwxr-xr-x' : '-rw-r--r--';
                const link = '1';
                const own = 'user';
                const grp = 'user';
                const sz = showHuman ? 
                    this.humanizeSize(fileSizes[file]) : 
                    fileSizes[file].toString();
                const dt = 'Nov 19 11:34';

                // ファイル名の色分け
                const coloredName = isDirectory ? 
                    `<span class="directory">${file}</span>` : 
                    `<span class="file">${file}</span>`;

                // 各フィールドを固定幅でパディング
                return [
                    perms.padEnd(format.perms),
                    link.padStart(format.links),
                    own.padEnd(format.owner),
                    grp.padEnd(format.group),
                    sz.padStart(format.size),
                    dt.padEnd(format.date),
                    coloredName
                ].join(' ');  // スペース1つで区切る
            }).join('\n');

            return result + '</pre>';
        } else {
            // 通常表示（横並び）
            return '<pre style="font-size: 16px;">' + files.map(file => {
                const isDirectory = file === '.' || file === '..';
                return isDirectory ? 
                    `<span class="directory">${file}</span>` : 
                    `<span class="file">${file}</span>`;
            }).join('    ') + '</pre>';
        }
    }

    // ファイルサイズを人間読みやすい形式に変換するヘルパーメソッド
    humanizeSize(bytes) {
        const units = ['B', 'K', 'M', 'G'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${Math.round(size)}${units[unitIndex]}`;
    }

    showDatabases() {
        // データベース一覧を取得
        const databases = Object.keys(this.data.databases);
        
        // PostgreSQL形式 (\l の場合)
        if (this.lastCommand && this.lastCommand.startsWith('\\')) {
            let result = '                                  List of databases\n';
            result += '    Name    | Owner | Encoding |   Collate   |    Ctype    | Access privileges\n';
            result += '-----------+-------+----------+-------------+-------------+-------------------\n';
            databases.forEach(db => {
                result += ` ${db.padEnd(10)}| user  | UTF8     | en_US.UTF-8 | en_US.UTF-8 | \n`;
            });
            return result;
        }
        
        // MySQL形式 (SHOW DATABASES; の場合)
        let result = '+-------------+\n';
        result += '| Database    |\n';
        result += '+-------------+\n';
        databases.forEach(db => {
            result += `| ${db.padEnd(11)} |\n`;
        });
        result += '+-------------+\n';
        return result;
    }

    showTables() {
        if (!this.currentDB) {
            return 'Error: No database selected. Use "\\c [database_name]" or "use [database_name];"';
        }

        const tables = Object.keys(this.data.databases[this.currentDB].tables);
        
        // PostgreSQL形式 (\dt の場合)
        if (this.lastCommand && this.lastCommand.startsWith('\\')) {
            let result = '             List of relations\n';
            result += ' Schema |     Name      | Type  | Owner\n';
            result += '--------+--------------+-------+-------\n';
            tables.forEach(table => {
                result += ` public | ${table.padEnd(12)} | table | user\n`;
            });
            return result;
        }
        
        // MySQL形式 (SHOW TABLES; の場合)
        let result = '+------------------------+\n';
        result += `| Tables_in_${this.currentDB}${' '.repeat(Math.max(0, 23 - this.currentDB.length))}|\n`;
        result += '+------------------------+\n';
        tables.forEach(table => {
            result += `| ${table.padEnd(22)} |\n`;
        });
        result += '+------------------------+\n';
        return result;
    }

    executeSelect(query) {
        if (!this.currentDB) {
            return 'Error: No database selected';
        }

        const table = this.data.databases[this.currentDB].tables[query.table];
        if (!table) {
            return `Error: Table "${query.table}" not found`;
        }

        let data = [...table.data];
        const columns = query.columns[0] === '*' ? table.columns : query.columns;
        const columnIndexes = columns.map(col => table.columns.indexOf(col));

        // 表示用の整形
        const getDisplayLength = (str) => {
            return [...String(str)].reduce((acc, char) => {
                return acc + (char.match(/[\u0020-\u007e]/) ? 1 : 2);
            }, 0);
        };

        const padEndDisplay = (str, length) => {
            const displayLength = getDisplayLength(str);
            return String(str) + ' '.repeat(Math.max(0, length - displayLength));
        };

        const columnWidths = columns.map((col, i) => {
            const columnIndex = columnIndexes[i];
            const headerLength = getDisplayLength(col);
            const maxDataLength = data.reduce((max, row) => {
                const cellLength = getDisplayLength(String(row[columnIndex]));
                return Math.max(max, cellLength);
            }, 0);
            return Math.max(headerLength, maxDataLength);
        });

        let result = '+-' + columnWidths.map(width => '-'.repeat(width)).join('-+-') + '-+\n';
        result += '| ' + columns.map((col, i) => 
            padEndDisplay(col, columnWidths[i])
        ).join(' | ') + ' |\n';
        result += '+-' + columnWidths.map(width => '-'.repeat(width)).join('-+-') + '-+\n';

        data.forEach(row => {
            result += '| ' + columnIndexes.map((colIndex, i) => 
                padEndDisplay(String(row[colIndex]), columnWidths[i])
            ).join(' | ') + ' |\n';
        });

        result += '+-' + columnWidths.map(width => '-'.repeat(width)).join('-+-') + '-+\n';

        return result;
    }

    useDatabase(dbName) {
        if (this.data.databases[dbName]) {
            this.currentDB = dbName;
            
            // PostgreSQL形式 (\c の場合)
            if (this.lastCommand && this.lastCommand.startsWith('\\')) {
                return `You are now connected to database "${dbName}" as user "user"`;
            }
            
            // MySQL形式 (USE の場合)
            return `Database changed to ${dbName}`;
        }
        return `Error: Database "${dbName}" does not exist`;
    }

    displayImage(filename) {
        if (!this.imagePaths[filename]) {
            return `Error: Image "${filename}" not found`;
        }

        const imageClass = filename.startsWith('img2sixel') ? 'terminal-sixel' : 'terminal-imgcat';
        
        return `<div class="terminal-image ${imageClass}">
            <img src="${this.imagePaths[filename]}" alt="${filename}" 
                 style="max-width: 500px; max-height: 300px;">
        </div>`;
    }

    describeTable(tableName) {
        if (!this.currentDB) {
            return 'Error: No database selected. Use "\\c [database_name]" or "use [database_name];"';
        }

        const table = this.data.databases[this.currentDB].tables[tableName];
        if (!table) {
            return `Error: Table "${tableName}" does not exist`;
        }

        // PostgreSQL形式のテーブル構造を表示
        let result = `                                Table "${this.currentDB}.public.${tableName}"\n`;
        result += ' Column              | Type                        | Collation | Nullable | Default\n';
        result += '--------------------+----------------------------+-----------+----------+---------\n';

        table.columns.forEach((col, index) => {
            // 型情報を推測（実際のデータから）
            let type = 'text';
            if (table.data.length > 0) {
                const value = table.data[0][index];
                if (typeof value === 'number') {
                    if (Number.isInteger(value)) {
                        type = 'integer';
                    } else {
                        type = 'numeric';
                    }
                }
            }

            // カラム名と型情報を整形
            const colName = col.padEnd(19);
            const typeInfo = type.padEnd(27);
            result += ` ${colName}| ${typeInfo}|           | not null | \n`;
        });

        result += 'Indexes:\n';
        result += '    "' + tableName + '_pkey" PRIMARY KEY, btree (id)\n';

        return result;
    }
} 
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('sql-input');
    const currentInput = document.getElementById('current-input');
    const output = document.getElementById('output');
    const console = document.getElementById('console');
    const db = new Database(CAREER_DB);
    let currentQuery = '';
    let isSelecting = false;
    let commandHistory = [];
    let historyIndex = -1;
    let cursorPosition = 0;
    let isAtEnd = true;

    function getPrompt() {
        if (db.currentDB) {
            return `${db.currentDB}=> `;
        }
        return 'sql> ';
    }

    function appendOutput(text) {
        if (text.startsWith('sql>') || text.includes('=>')) {
            output.innerHTML += `${text}\n`;
        } else {
            output.innerHTML += `${text}\n`;
        }
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        });
    }

    function updateDisplay() {
        const value = input.value;
        const before = value.slice(0, cursorPosition);
        const after = value.slice(cursorPosition);
        
        isAtEnd = (cursorPosition === value.length);
        
        // プロンプトを更新
        const prompt = document.querySelector('.prompt');
        if (prompt) {
            prompt.textContent = getPrompt();
        }
        
        if (isAtEnd) {
            currentInput.innerHTML = escapeHtml(value) + '<span class="cursor"></span>';
        } else {
            currentInput.innerHTML = escapeHtml(before) + 
                                   '<span class="cursor overlap">' + 
                                   escapeHtml(after[0]) + 
                                   '</span>' + 
                                   escapeHtml(after.slice(1));
        }
        
        input.selectionStart = cursorPosition;
        input.selectionEnd = cursorPosition;

        ensureInputVisible();
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/ /g, "&nbsp;");
    }

    function executeCommand(command) {
        const prompt = getPrompt();
        
        // 複数行の入力を処理
        const lines = command.split('\n');
        lines.forEach((line, index) => {
            // 最初の行のみプロンプトを表示
            if (index === 0) {
                appendOutput(`${prompt}${line}`);
            } else {
                // 継続行のプロンプトを表示
                const contPrompt = prompt.replace(/[^ ]>/, '->');
                appendOutput(`${contPrompt}${line}`);
            }
        });
        
        if (command.trim()) {
            const parsedQuery = SQLParser.parse(command);
            if (parsedQuery) {
                const result = db.executeQuery(parsedQuery);
                if (result) {
                    appendOutput(result);
                }
            }
        }
    }

    // input イベントリスナーを修正
    input.addEventListener('input', (e) => {
        // 在の入力値とカーソル位置を取得
        const newValue = input.value;
        const newCursorPosition = input.selectionStart;
        
        // カーソル位置を更新
        cursorPosition = newCursorPosition;
        isAtEnd = (cursorPosition === newValue.length);
        
        // 表示を更新
        updateDisplay();
    });

    // キー入力の処理を修正
    input.addEventListener('keydown', (e) => {
        // コントロール+Cの処理
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            const prompt = getPrompt();
            appendOutput(`${prompt}${input.value}`);
            appendOutput('^C');
            input.value = '';
            cursorPosition = 0;
            isAtEnd = true;
            currentQuery = '';  // 現在のクエリをクリア
            updateDisplay();
            return;
        }

        // 他のコントロールキーは無視
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // 特殊キーの処理
        switch (e.key) {
            case 'Tab':
                e.preventDefault();
                const completions = SQLParser.getCompletions(input.value, db);
                if (completions.length === 1) {
                    const words = input.value.split(' ');
                    words.pop();
                    input.value = [...words, completions[0]].join(' ').toLowerCase();
                    cursorPosition = input.value.length;
                    isAtEnd = true;
                    updateDisplay();
                }
                break;

            case 'Enter':
                e.preventDefault();
                const inputValue = input.value;
                
                // PostgreSQLコマンドの場合は即時実行
                if (inputValue.trim().startsWith('\\')) {
                    const prompt = getPrompt();
                    appendOutput(`${prompt}${inputValue}`);
                    const result = SQLParser.parse(inputValue);
                    if (result) {
                        const output = db.executeQuery(result);
                        if (output) {
                            appendOutput(output);
                        }
                    }
                    currentQuery = '';
                } else {
                    // 空行を含む全ての入力を処理
                    if (currentQuery) {
                        // 継続行のプロンプトを表示
                        const prompt = getPrompt().replace(/[^ ]>/, '->');
                        appendOutput(`${prompt}${inputValue}`);
                        
                        // 空行でない場合のみクエリに追加
                        if (inputValue.trim()) {
                            currentQuery += '\n' + inputValue;
                        }
                    } else {
                        // 最初の行
                        const prompt = getPrompt();
                        appendOutput(`${prompt}${inputValue}`);
                        if (inputValue.trim()) {
                            currentQuery = inputValue;
                        }
                    }

                    // セミコロンで終わる場合はクエリを実行
                    if (currentQuery && currentQuery.trim().endsWith(';')) {
                        commandHistory.push(currentQuery);
                        historyIndex = -1;
                        const result = SQLParser.parse(currentQuery);
                        if (result) {
                            const output = db.executeQuery(result);
                            if (output) {
                                appendOutput(output);
                            }
                        }
                        currentQuery = '';
                    }
                }
                
                input.value = '';
                cursorPosition = 0;
                isAtEnd = true;
                updateDisplay();
                break;

            case 'ArrowLeft':
                e.preventDefault();
                if (cursorPosition > 0) {
                    cursorPosition--;
                    isAtEnd = false;
                    updateDisplay();
                }
                break;

            case 'ArrowRight':
                e.preventDefault();
                if (cursorPosition < input.value.length) {
                    cursorPosition++;
                    isAtEnd = (cursorPosition === input.value.length);
                    updateDisplay();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    input.value = commandHistory[commandHistory.length - 1 - historyIndex];
                    cursorPosition = input.value.length;
                    isAtEnd = true;
                    updateDisplay();
                }
                break;

            case 'ArrowDown':
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    input.value = commandHistory[commandHistory.length - 1 - historyIndex];
                    cursorPosition = input.value.length;
                    isAtEnd = true;
                    updateDisplay();
                } else if (historyIndex === 0) {
                    historyIndex = -1;
                    input.value = '';
                    cursorPosition = 0;
                    isAtEnd = true;
                    updateDisplay();
                }
                break;

            case 'Home':
                e.preventDefault();
                cursorPosition = 0;
                isAtEnd = false;
                updateDisplay();
                break;

            case 'End':
                e.preventDefault();
                cursorPosition = input.value.length;
                isAtEnd = true;
                updateDisplay();
                break;
        }
    });

    // 選択処理
    document.addEventListener('mousedown', () => {
        isSelecting = true;
    });

    document.addEventListener('mouseup', () => {
        setTimeout(() => {
            if (!window.getSelection().toString()) {
                input.focus();
            }
            isSelecting = false;
        }, 10);
    });

    // 初期フォーカス
    input.focus();
    isAtEnd = true;
    updateDisplay();

    // 力行が見えるようにスクロールする関数を追加
    function ensureInputVisible() {
        const inputLine = document.getElementById('input-line');
        const inputRect = inputLine.getBoundingClientRect();
        const consoleRect = console.getBoundingClientRect();
        
        // 常に最下部にスクロール
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        });
    }
}); 
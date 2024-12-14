import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Database } from 'lib/database';
import { SQLParser } from 'lib/sqlParser';
import { DatabaseStructure, SimpleQuery } from 'lib/types';
import personalData from 'data/personal_data.json';
import { useRouter } from 'next/router';
import { track } from '@vercel/analytics';

interface TerminalProps {
  className?: string;
  initialData: DatabaseStructure;
}

const isFullWidth = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x3000 && code <= 0x9FFF) ||    // CJK統合漢字、ひらがな、カタカナなど
    (code >= 0xFF00 && code <= 0xFFEF) ||    // 全角英数字、記号
    (code >= 0x20000 && code <= 0x2FFFF)     // CJK拡張漢字
  );
};

export const Terminal: React.FC<TerminalProps> = ({ className, initialData }) => {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [output, setOutput] = useState<string[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isTerminalMode, setIsTerminalMode] = useState(true);
  const router = useRouter();
  const [sqlHistory, setSqlHistory] = useState<string[]>([]);
  const [terminalHistory, setTerminalHistory] = useState<string[]>(['imgcat profile.png']);

  const db = useRef(new Database(initialData, () => {
    setOutput(prev => [...prev, 'Bye']);
    setTimeout(() => {
      setIsTerminalMode(false);
      setOutput([]);
      setCommandHistory(terminalHistory);
    }, 1000);
  }));

  // プロンプトを取得
  const getPrompt = () => {
    if (!isTerminalMode) {
      return 'user@localhost:~$ ';
    }
    return db.current.currentDB ? `${db.current.currentDB}-> ` : 'sql-> ';
  };

  // 出力を追加
  const appendOutput = (text: string) => {
    setOutput(prev => [...prev, text]);
  };

  // 出力が更新されたときにスクロール
  useLayoutEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.scrollTop = wrapperRef.current.scrollHeight;
    }
  }, [output]);

  // コンポーネントがマウントされたときに入力欄にフォーカス
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 入力更を処理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // キャレット位置を更新
    const selectionStart = e.target.selectionStart || 0;
    setCursorPosition(selectionStart);
  };

  // コマンドを実行
  const executeCommand = async (command: string) => {
    if (!isTerminalMode) {
      // ターミナルコマンドのトラッキング
      track('terminal_command_executed', {
        command: command,
        timestamp: new Date().toISOString()
      });
      
      appendOutput(`${getPrompt()}${command}`);
      executeTerminalCommand(command);
      setTerminalHistory(prev => [command, ...prev]);
      setInput('');
      setCursorPosition(0);
      setHistoryIndex(-1);
      return;
    }

    if (command.trim()) {
      if (command.trim() === '\\q' || command.trim().toLowerCase() === 'exit') {
        appendOutput('Exiting SQL terminal...');
        setSqlHistory(commandHistory); // SQLモードの履歴を保存
        setCommandHistory(terminalHistory); // ターミナルモードの履歴を復元
        db.current.onExit?.();
        return;
      }

      const parsedQuery = SQLParser.parse(command);
      if (parsedQuery) {
        try {
          const result = await db.current.executeQuery(parsedQuery);
          if (result) {
            appendOutput(result);
          }
          setSqlHistory(prev => [command, ...prev]);
        } catch (error) {
          // エラーのトラッキング
          track('sql_query_error', {
            command: command,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          appendOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    setInput('');
    setCursorPosition(0);
    setHistoryIndex(-1);
  };

  // キー押下を処理
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+C の処理を追加
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      const parsedQuery: SimpleQuery = {
        type: 'CANCEL',
        originalCommand: ''
      };
      appendOutput(`${getPrompt()}${input}`);
      try {
        const result = await db.current.executeQuery(parsedQuery);
        if (result) {
          appendOutput(result);
        }
      } catch (error) {
        appendOutput(`Error: ${error}`);
      }
      setInput('');
      setCursorPosition(0);
      setCurrentQuery('');
      return;
    }

    // メタキー（Command/Ctrl）が押されている場合は、ブラウザのデフォルト動作を許可
    if (e.metaKey || e.ctrlKey) {
      return;
    }

    // IME入力中は全ての処理をスキップ
    if (isComposing) {
      return;
    }

    // 特殊キーの処理
    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        const completions = SQLParser.getCompletions(input, db.current);
        if (completions.length === 1) {
          const words = input.slice(0, cursorPosition).split(/\s+/);
          const currentWord = words[words.length - 1] || '';
          const newInput =
            input.slice(0, cursorPosition - currentWord.length) +
            completions[0] +
            input.slice(cursorPosition);
          setInput(newInput);
          setCursorPosition(cursorPosition - currentWord.length + completions[0].length);

          // フォーカスを維持
          setTimeout(() => {
            inputRef.current?.setSelectionRange(
              cursorPosition - currentWord.length + completions[0].length,
              cursorPosition - currentWord.length + completions[0].length
            );
          }, 0);
        }
        break;

      case 'Enter':
        e.preventDefault();
        const inputValue = input;
        
        if (!isTerminalMode) {
          // 通常ターミナルモードの場合
          appendOutput(`${getPrompt()}${inputValue}`);
          executeTerminalCommand(inputValue);
          setInput('');
          setCursorPosition(0);
          setHistoryIndex(-1);
          return;
        }

        // SQLモードの場合
        appendOutput(`${getPrompt()}${inputValue}`);
        if (inputValue.trim().startsWith('\\')) {
          executeCommand(inputValue);
          setCurrentQuery('');
        } else {
          const newQuery = currentQuery ? `${currentQuery}\n${inputValue}` : inputValue;
          if (inputValue.trim().endsWith(';')) {
            setCommandHistory(prev => [newQuery, ...prev]);
            executeCommand(newQuery);
            setCurrentQuery('');
          } else {
            setCurrentQuery(newQuery);
          }
        }
        setInput('');
        setCursorPosition(0);
        setHistoryIndex(-1);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
          setCursorPosition(commandHistory[newIndex].length);

          setTimeout(() => {
            inputRef.current?.setSelectionRange(
              commandHistory[newIndex].length,
              commandHistory[newIndex].length
            );
          }, 0);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
          setCursorPosition(commandHistory[newIndex].length);

          setTimeout(() => {
            inputRef.current?.setSelectionRange(
              commandHistory[newIndex].length,
              commandHistory[newIndex].length
            );
          }, 0);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput('');
          setCursorPosition(0);
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        setCursorPosition(prev => Math.max(prev - 1, 0));

        // フォーカスを維持
        setTimeout(() => {
          inputRef.current?.setSelectionRange(
            Math.max(cursorPosition - 1, 0),
            Math.max(cursorPosition - 1, 0)
          );
        }, 0);
        break;

      case 'ArrowRight':
        e.preventDefault();
        setCursorPosition(prev => Math.min(prev + 1, input.length));

        // フォーカスを維持
        setTimeout(() => {
          inputRef.current?.setSelectionRange(
            Math.min(cursorPosition + 1, input.length),
            Math.min(cursorPosition + 1, input.length)
          );
        }, 0);
        break;

      case 'Backspace':
        e.preventDefault();
        if (cursorPosition > 0) {
          const newInput =
            input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
          setInput(newInput);
          setCursorPosition(prev => prev - 1);

          // フォーカスを維持
          setTimeout(() => {
            inputRef.current?.setSelectionRange(
              cursorPosition - 1,
              cursorPosition - 1
            );
          }, 0);
        }
        break;

      case 'Delete':
        e.preventDefault();
        if (cursorPosition < input.length) {
          const newInput =
            input.slice(0, cursorPosition) + input.slice(cursorPosition + 1);
          setInput(newInput);

          // フォーカスを維持
          setTimeout(() => {
            inputRef.current?.setSelectionRange(
              cursorPosition,
              cursorPosition
            );
          }, 0);
        }
        break;

      default:
        // 文字入力は onChange で処理されるため、ここでは特に処理しない
        break;
    }
  };

  // テキスト選択の処理を追加
  const handleClick = (e: React.MouseEvent) => {
    // 選択中のテキストがある場合は何もしない
    if (window.getSelection()?.toString()) {
      e.stopPropagation();
      return;
    }
    
    // 入力行をクリックした場合のみフォーカス
    if ((e.target as HTMLElement).closest('.terminal-input-line')) {
      inputRef.current?.focus();
    }
  };

  // useEffectを修正
  useEffect(() => {
    // 入力欄へ��初期フォーカス
    inputRef.current?.focus();

    // マウスアップ時のフォーカス制御
    const handleMouseUp = () => {
      // 選択中のテキストがある場合は何もしない
      if (window.getSelection()?.toString()) {
        return;
      }
      
      // 選択がない場合のみフォーカスを戻す
      inputRef.current?.focus();
    };

    // マウスアップイベントのリスナーを追加
    document.addEventListener('mouseup', handleMouseUp);

    // クリーンアップ
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // HTMLエスケープ（出力部分のみ使用）
  const renderInput = () => {
    const charAtCursor = input.charAt(cursorPosition) || ' ';
    const isFullWidthChar = isFullWidth(charAtCursor);
    const cursorWidth = isFullWidthChar ? '1em' : '0.6em'; // 幅を調整
    const cursorMargin = isFullWidthChar ? '0 -1em 0 0' : '0 -0.6em 0 0'; // マージンを調整
  
    return (
      <div className="terminal-input-container">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          className="terminal-input"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            zIndex: 1,
            color: 'transparent',
            caretColor: 'transparent',
          }}
        />
        <span className="terminal-input-display">
          {input.slice(0, cursorPosition)}
          <span 
            className="terminal-cursor" 
            style={{ 
              width: cursorWidth,
              margin: cursorMargin
            }} 
          />
          {input.slice(cursorPosition)}
        </span>
      </div>
    );
  };

  // 新しいターミナルモードのコマンド処理を修正
  const executeTerminalCommand = (command: string) => {
    const [cmd, ...args] = command.trim().split(/\s+/);
    
    switch (cmd.toLowerCase()) {
      case 'ls':
        const options = args.filter(arg => arg.startsWith('-')).join('').replace(/-/g, '');
        appendOutput(formatLsOutput(db.current.files, options));
        break;
      case 'img2sixel':
      case 'imgcat':
        if (args.length === 0) {
          appendOutput(`Error: ${cmd} requires a filename argument`);
          break;
        }
        const filename = args[0];
        // ファイルの存在チェックを修正
        if (!db.current.files.includes(filename)) {
          appendOutput(`Error: Image "${filename}" not found`);
          break;
        }
        appendOutput(`<div class="terminal-image"><img src="/data/images/${filename}" alt="${filename}" style="max-width: 500px; max-height: 300px;"></div>`);
        break;
      case 'clear':
        setOutput([]);
        break;
      case 'sql':
        setIsTerminalMode(true);
        setOutput([]);
        setCommandHistory(sqlHistory); // SQLモードの履歴を復元
        break;
      default:
        appendOutput(`command not found: ${cmd}`);
    }
  };

  // Terminal コンポーネント内に以下の関数を追加
  const formatLsOutput = (files: string[], options: string): string => {
    const showAll = options.includes('a');
    const showList = options.includes('l');
    const showHuman = options.includes('h');

    let displayFiles = [...files];
    if (showAll) {
      displayFiles = ['.', '..', ...displayFiles];
    }

    if (showList) {
      const fileSizes = {
        '.': 4096,
        '..': 4096,
        'secret.png': 245760,    // 240KB
        'profile.png': 153600    // 150KB
      };

      let result = 'total 456\n';
      
      // 各カラムの固定幅を設定
      const format = {
        perms: 10,    // -rw-r--r--
        links: 2,     // 1
        owner: 6,     // user
        group: 6,     // user
        size: 8,      // ファイルサイズ
        date: 12,     // Nov 19 11:34
      };

      const rows = displayFiles.map(file => {
        const isDirectory = file === '.' || file === '..';
        const perms = isDirectory ? 'drwxr-xr-x' : '-rw-r--r--';
        const link = '1';
        const own = 'user';
        const grp = 'user';
        const sz = showHuman ? 
          humanizeSize(fileSizes[file as keyof typeof fileSizes]) : 
          String(fileSizes[file as keyof typeof fileSizes]);
        const dt = 'Nov 19 11:34';

        // ファイル名の色分け用のクラス
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
      });

      return `<pre style="font-size: 16px;">${rows.join('\n')}</pre>`;
    } else {
      // 通常表示（横並び）
      return '<pre style="font-size: 16px;">' + displayFiles.map(file => {
        const isDirectory = file === '.' || file === '..';
        return isDirectory ? 
          `<span class="directory">${file}</span>` : 
          `<span class="file">${file}</span>`;
      }).join('    ') + '</pre>';
    }
  };

  // ファイルサイズを間が読みやすい形式に変換するヘルパー関数
  const humanizeSize = (bytes: number): string => {
    const units = ['B', 'K', 'M', 'G'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size)}${units[unitIndex]}`;
  };

  // データベース一覧の取得
  const fetchDatabases = async () => {
    const response = await fetch('/api/databases');
    const data = await response.json();
    return data.databases;
  };

  // データベース構成の取得
  const fetchDatabaseStructure = async (dbName: string) => {
    const response = await fetch(`/api/database-structure?dbName=${dbName}`);
    const data = await response.json();
    return data.structure;
  };

  // クエリの実行
  const executeQuery = async (dbName: string, query: string) => {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dbName, query }),
    });
    const data = await response.json();
    return data.result;
  };

  return (
    <div
      className={`terminal-wrapper ${className}`}
      onClick={handleClick}
      ref={wrapperRef}
    >
      <div className="terminal-output">
        {output.map((line, i) => (
          <div key={i} dangerouslySetInnerHTML={{ 
            __html: line.startsWith('<') ? line : escapeHtml(line) 
          }} />
        ))}
      </div>
      <div className="terminal-input-line">
        <span className="terminal-prompt">{getPrompt()}</span>
        {renderInput()}
      </div>
    </div>
  );
};

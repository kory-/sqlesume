'use client'

import { useEffect, useState } from 'react';
import { Terminal } from 'components/Terminal';
import { DatabaseStructure } from 'lib/types';
import { LoadingTerminal } from 'components/LoadingTerminal';

export default function Home() {
  const [initialData, setInitialData] = useState<DatabaseStructure | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // データベース一覧のみを最初に取得
        const response = await fetch('/api/databases');
        const { databases } = await response.json();
        
        // DatabaseStructure型に合わせて初期データを構築
        setInitialData({
          currentDB: null,
          data: {
            databases: databases.reduce((acc: any, dbName: string) => {
              acc[dbName] = {
                tables: {}  // テーブル情報は後で必要に応じて取得
              };
              return acc;
            }, {})
          }
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  if (isLoading || !initialData) {
    return <LoadingTerminal />;
  }

  return (
    <div className="terminal-container">
      <Terminal className="terminal" initialData={initialData} />
    </div>
  );
} 
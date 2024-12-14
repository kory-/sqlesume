import { NextApiRequest, NextApiResponse } from 'next';
import personalData from 'data/personal_data.json';
import { SQLParser } from 'lib/sqlParser';
import { SelectQuery } from 'lib/types';
import alasql from 'alasql';
import { track } from '@vercel/analytics/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { dbName, query } = req.body;

  if (!dbName || !query) {
    return res.status(400).json({ error: 'Database name and query are required' });
  }

  // クエリ実行をトラッキング
  await track('sql_query_executed', { 
    database: dbName,
    query: query,
    timestamp: new Date().toISOString()
  });

  const db = personalData.databases[dbName as keyof typeof personalData.databases];
  if (!db) {
    return res.status(404).json({ error: 'Database not found' });
  }

  try {
    const parsedQuery = SQLParser.parse(query);
    if (!parsedQuery) {
      return res.status(400).json({ error: 'Invalid query' });
    }

    if (parsedQuery.type === 'SELECT') {
      // データベースを作成
      try {
        alasql(`DROP DATABASE IF EXISTS ${dbName}`);
      } catch (e) {
        console.warn('Error dropping database:', e);
      }
      
      alasql(`CREATE DATABASE ${dbName}`);
      alasql(`USE ${dbName}`);

      // 必要なすべてのテーブルを作成してデータを投入
      for (const [tableName, table] of Object.entries(db.tables)) {
        try {
          // テーブルのスキーマを作成
          const columnDefs = table.columns.map((col: string) => {
            // IDカラムは数値型として定義
            if (col.toLowerCase() === 'id') return `${col} INT`;
            // company_idなどの外部キーも数値型
            if (col.toLowerCase().endsWith('_id')) return `${col} INT`;
            // years_usedなども数値型
            if (col.toLowerCase().includes('year')) return `${col} INT`;
            // それ以外は文字列型
            return `${col} STRING`;
          }).join(', ');

          // テーブルを作成
          alasql(`CREATE TABLE ${tableName} (${columnDefs})`);

          // データを投入
          if (table.data && table.data.length > 0) {
            const placeholders = table.columns.map(() => '?').join(', ');
            const insertSql = `INSERT INTO ${tableName} VALUES (${placeholders})`;
            table.data.forEach((row: (string | number)[]) => {
              try {
                alasql(insertSql, row);
              } catch (error) {
                console.error(`Error inserting row into ${tableName}:`, error, row);
              }
            });
          }
        } catch (error) {
          console.error(`Error setting up table ${tableName}:`, error);
        }
      }

      try {
        // クエリを実行
        const result = alasql(query);
        console.log('Query result:', result); // デバッグ用

        // 結果を返す
        return res.status(200).json({
          result,
          columns: result.length > 0 ? Object.keys(result[0]) : []
        });
      } catch (error) {
        console.error('Error executing query:', error);
        return res.status(500).json({ error: 'Query execution failed' });
      }
    }

    return res.status(400).json({ error: 'Unsupported query type' });
  } catch (error) {
    console.error('Query execution error:', error);
    return res.status(500).json({ error: 'Query execution failed' });
  } finally {
    // クリーンアップ: データベースを削除
    try {
      alasql(`DROP DATABASE IF EXISTS ${dbName}`);
    } catch (e) {
      console.warn('Error cleaning up database:', e);
    }
  }
} 
import { NextApiRequest, NextApiResponse } from 'next';
import personalData from 'data/personal_data.json';
import { DatabaseTable } from 'lib/types';

type DatabaseTables = {
  [tableName: string]: DatabaseTable;
};

type DatabaseStructure = {
  [dbName: string]: {
    tables: DatabaseTables;
  };
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { dbName } = req.query;

  if (!dbName || typeof dbName !== 'string') {
    return res.status(400).json({ error: 'Database name is required' });
  }

  const db = (personalData.databases as DatabaseStructure)[dbName];
  if (!db) {
    return res.status(404).json({ error: 'Database not found' });
  }

  // テーブル構造のみを返す（データは含まない）
  const structure = Object.entries(db.tables).reduce<DatabaseTables>((acc, [tableName, table]) => {
    acc[tableName] = {
      columns: table.columns
    };
    return acc;
  }, {});

  res.status(200).json({ structure });
} 
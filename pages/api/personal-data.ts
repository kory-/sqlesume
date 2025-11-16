import { NextApiRequest, NextApiResponse } from 'next';
import personalData from 'data/personal_data.json';
import { Databases } from 'lib/types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const sanitizedData: { databases: Databases } = {
    databases: Object.entries(personalData.databases).reduce((acc, [dbName, db]) => {
      acc[dbName] = {
        tables: Object.entries(db.tables).reduce((tableAcc, [tableName, table]) => {
          if (tableName === 'personal_info') {
            tableAcc[tableName] = {
              columns: table.columns,
              data: table.data.map(row => row.slice(0, 3))
            };
          } else {
            tableAcc[tableName] = table;
          }
          return tableAcc;
        }, {} as { [key: string]: { columns: string[]; data: (string | number)[][]; } })
      };
      return acc;
    }, {} as Databases)
  };

  res.status(200).json(sanitizedData);
} 
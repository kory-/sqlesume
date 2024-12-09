import { NextApiRequest, NextApiResponse } from 'next';
import personalData from 'data/personal_data.json';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const databases = Object.keys(personalData.databases);
  res.status(200).json({ databases });
} 
import { NextApiRequest, NextApiResponse } from 'next';
import personalData from 'data/personal_data.json';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(personalData);
} 
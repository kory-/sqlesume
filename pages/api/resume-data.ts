import { NextApiRequest, NextApiResponse } from 'next';
import resumeData from 'data/resume_data.json';

// Edge Runtimeを設定
// export const runtime = 'edge';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(resumeData);
} 
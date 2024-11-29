'use client'

import { GetServerSideProps } from 'next';
import { Terminal } from '../components/Terminal';
import resumeData from '../data/resume_data.json';

// SSRでデータを取得
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      initialData: resumeData
    }
  };
};

interface HomeProps {
  initialData: typeof resumeData;
}

export default function Home({ initialData }: HomeProps) {
  return (
    <div className="terminal-container">
      <Terminal className="terminal" initialData={initialData} />
    </div>
  );
} 
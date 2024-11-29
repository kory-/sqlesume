'use client'

import { GetServerSideProps } from 'next';
import { Terminal } from 'components/Terminal';
import personalData from 'data/personal_data.json';

// SSRでデータを取得
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      initialData: personalData
    }
  };
};

interface HomeProps {
  initialData: typeof personalData;
}

export default function Home({ initialData }: HomeProps) {
  return (
    <div className="terminal-container">
      <Terminal className="terminal" initialData={initialData} />
    </div>
  );
} 
import type { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { SupportedPlatforms } from '@/components/SupportedPlatforms';
import { HowItWorks } from '@/components/HowItWorks';
import { Faq } from '@/components/Faq';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <SupportedPlatforms />
      <HowItWorks />
      <Faq />
    </>
  );
}

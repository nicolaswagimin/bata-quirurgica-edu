import { LandingFinal } from '../components/landing-final.tsx';
import { LandingHero } from '../components/landing-hero.tsx';
import { LandingSections } from '../components/landing-sections.tsx';

export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <LandingSections />
      <LandingFinal />
    </>
  );
}

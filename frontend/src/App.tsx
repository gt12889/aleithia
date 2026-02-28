import { useState } from 'react'
import type { UserProfile } from './types/index.ts'
import LandingPage from './components/LandingPage.tsx'
import OnboardingForm from './components/OnboardingForm.tsx'
import Dashboard from './components/Dashboard.tsx'

type View = 'landing' | 'onboarding' | 'dashboard'

function App() {
  const [view, setView] = useState<View>('landing')
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const handleProfileSubmit = (p: UserProfile) => {
    setProfile(p)
    setView('dashboard')
  }

  if (view === 'landing') {
    return <LandingPage onGetStarted={() => setView('onboarding')} />
  }

  if (view === 'onboarding' || !profile) {
    return <OnboardingForm onSubmit={handleProfileSubmit} />
  }

  return <Dashboard profile={profile} onReset={() => { setProfile(null); setView('landing') }} />
}

export default App

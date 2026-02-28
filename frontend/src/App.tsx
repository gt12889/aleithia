import { useState } from 'react'
import type { UserProfile } from './types/index.ts'
import OnboardingForm from './components/OnboardingForm.tsx'
import Dashboard from './components/Dashboard.tsx'

function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  if (!profile) {
    return <OnboardingForm onSubmit={setProfile} />
  }

  return <Dashboard profile={profile} onReset={() => setProfile(null)} />
}

export default App

import { useEffect, useState } from 'react'
import { useUser, useAuth } from '@clerk/clerk-react'
import type { UserProfile } from './types/index.ts'
import { api } from './api.ts'
import LandingPage from './components/LandingPage.tsx'
import OnboardingForm from './components/OnboardingForm.tsx'
import Dashboard from './components/Dashboard.tsx'
import ProfilePage from './components/ProfilePage.tsx'

type View = 'landing' | 'onboarding' | 'dashboard' | 'profile'
type NonProfileView = 'landing' | 'onboarding' | 'dashboard'

const initialView: View = window.location.pathname === '/profile' ? 'profile' : 'landing'

function App() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const [view, setView] = useState<View>(initialView)
  const [lastViewBeforeProfile, setLastViewBeforeProfile] = useState<NonProfileView>('landing')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const targetPath = view === 'profile' ? '/profile' : '/'
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath)
    }
  }, [view])

  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname === '/profile') {
        setView('profile')
        return
      }

      setView((prev) => (prev === 'profile' ? lastViewBeforeProfile : 'landing'))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [lastViewBeforeProfile])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return

    let cancelled = false

    // Get session token for API calls
    getToken().then((sessionToken) => {
      if (cancelled) return
      if (!sessionToken) return
      setToken(sessionToken)

      // Load saved profile from database
      api.getUserProfile(sessionToken)
        .then((profile) => {
          if (cancelled) return
          setSavedProfile({
            business_type: profile.business_type || '',
            neighborhood: profile.neighborhood || '',
          })
        })
        .catch(() => {
          if (cancelled) return
          setSavedProfile(null)
        })
    })

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, user, getToken])

  const handleProfileSubmit = async (p: UserProfile) => {
    setProfile(p)
    setView('dashboard')

    const sessionToken = token || await getToken()
    if (sessionToken) {
      try {
        await api.updateUserProfile(sessionToken, p.business_type, p.neighborhood)
        await api.createUserQuery(sessionToken, {
          query_text: `Analyze ${p.business_type} in ${p.neighborhood}`,
          business_type: p.business_type,
          neighborhood: p.neighborhood,
        })
        setSavedProfile(p)
      } catch {
        // Non-blocking save failure
      }
    }
  }

  const openProfile = () => {
    if (view !== 'profile') {
      setLastViewBeforeProfile(view as NonProfileView)
    }
    setView('profile')
  }

  const closeProfile = () => {
    setView(lastViewBeforeProfile)
  }

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#06080d]" />
  }

  if (!isSignedIn || view === 'landing') {
    return <LandingPage onGetStarted={() => setView('onboarding')} onOpenProfile={isSignedIn ? openProfile : undefined} />
  }

  if (view === 'profile') {
    return <ProfilePage onClose={closeProfile} token={token} onProfileUpdate={() => {
      // Reload profile after update
      if (token) {
        api.getUserProfile(token)
          .then((profile) => {
            setSavedProfile({
              business_type: profile.business_type || '',
              neighborhood: profile.neighborhood || '',
            })
          })
      }
    }} />
  }

  if (view === 'onboarding' || !profile) {
    return <OnboardingForm onSubmit={handleProfileSubmit} onCancel={() => setView('landing')} initialProfile={savedProfile} />
  }

  return <Dashboard profile={profile} onReset={() => { setProfile(null); setView('landing') }} token={token} onProfileClick={openProfile} />
}

export default App

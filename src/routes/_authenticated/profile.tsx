import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useUserProfile, useUpdateUserProfile } from '@/hooks/use-user-profile'
import { Button } from '@/components/ui/button'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { OneRmManagement } from '@/components/profile/one-rm-management'
import type { PreferredUnits } from '@/domain/types'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const auth = useAuth()
  const userId = auth.user?.id ?? ''
  const { data: profile, isLoading, isError } = useUserProfile(userId)
  const updateProfile = useUpdateUserProfile()

  const [displayName, setDisplayName] = useState<string | null>(null)
  const [bodyweight, setBodyweight] = useState<string | null>(null)
  const [preferredUnits, setPreferredUnits] = useState<PreferredUnits | null>(null)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  // Derive effective values: local state overrides profile data
  const effectiveDisplayName = displayName ?? profile?.displayName ?? ''
  const effectiveBodyweight = bodyweight ?? String(profile?.bodyweight?.value ?? '')
  const effectiveUnits = preferredUnits ?? profile?.preferredUnits ?? 'IMPERIAL'
  const bodyweightUnit = effectiveUnits === 'IMPERIAL' ? 'lb' : 'kg'

  const handleSaveSettings = async () => {
    if (!profile) return

    const bodyweightValue = parseFloat(effectiveBodyweight)
    const updates: Parameters<typeof updateProfile.mutateAsync>[0] = {
      id: profile.id,
      displayName: effectiveDisplayName || undefined,
      preferredUnits: effectiveUnits,
    }

    if (!isNaN(bodyweightValue) && bodyweightValue > 0) {
      updates.bodyweight = { value: bodyweightValue, unit: bodyweightUnit }
    }

    try {
      await updateProfile.mutateAsync(updates)

      // Reset local overrides after save
      setDisplayName(null)
      setBodyweight(null)
      setPreferredUnits(null)
    } catch (err) {
      console.error('[profile] Failed to save settings:', err)
    }
  }

  const handleSignOut = async () => {
    setSignOutError(null)
    const { error } = await auth.signOut()
    if (error) {
      console.error('[auth] Sign out failed:', error)
      setSignOutError('Sign out failed. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-surface-pit px-4 py-8 lg:px-8 lg:py-12">
        <Skeleton className="mb-8 h-8 w-32 rounded-none bg-surface-gunmetal" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-none bg-surface-gunmetal" />
          <Skeleton className="h-12 w-full rounded-none bg-surface-gunmetal" />
          <Skeleton className="h-12 w-full rounded-none bg-surface-gunmetal" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-surface-pit px-4">
        <span className="material-symbols-outlined mb-3 text-4xl text-warning-flare">
          cloud_off
        </span>
        <p className="font-display text-sm text-warning-flare">Failed to load profile</p>
        <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-surface-pit">
      <div className="mx-auto max-w-5xl px-4 lg:px-8">
        {/* Page header */}
        <div className="pt-8 pb-6 lg:pt-12">
          <h1 className="font-display text-3xl font-bold text-bone-white">Profile</h1>
        </div>

        {/* Two-column on desktop, single column on mobile */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-12">
          {/* Left column: settings + account */}
          <div>
            {/* SETTINGS section */}
            <section className="pb-8">
              <div className="border-t border-surface-steel pb-2 pt-4">
                <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
                  SETTINGS
                </h2>
              </div>

              <div className="mt-4 space-y-6">
                {/* Display name */}
                <div className="space-y-1">
                  <label className={FORGE_LABEL_CLASS}>Display name</label>
                  <ForgeInput
                    type="text"
                    value={effectiveDisplayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter display name"
                  />
                </div>

                {/* Bodyweight */}
                <div className="space-y-1">
                  <label className={FORGE_LABEL_CLASS}>Bodyweight</label>
                  <div className="flex items-end gap-3">
                    <ForgeInput
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={effectiveBodyweight}
                      onChange={(e) => setBodyweight(e.target.value)}
                      placeholder="0"
                      className="flex-1 font-display text-2xl"
                    />
                    <span className="pb-2 font-sans text-sm text-warm-ash">{bodyweightUnit}</span>
                  </div>
                </div>

                {/* Preferred units */}
                <div className="space-y-2">
                  <label className={FORGE_LABEL_CLASS}>Preferred units</label>
                  <ToggleGroup
                    type="single"
                    value={effectiveUnits}
                    onValueChange={(val) => {
                      if (val === 'IMPERIAL' || val === 'METRIC') {
                        setPreferredUnits(val)
                      }
                    }}
                    className="w-full"
                  >
                    <ToggleGroupItem
                      value="IMPERIAL"
                      className="min-h-[48px] flex-1 font-sans text-xs font-medium data-[state=on]:bg-forge data-[state=on]:text-on-forge"
                    >
                      Imperial
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="METRIC"
                      className="min-h-[48px] flex-1 font-sans text-xs font-medium data-[state=on]:bg-forge data-[state=on]:text-on-forge"
                    >
                      Metric
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Save settings button */}
                <Button
                  className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
                  onClick={handleSaveSettings}
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? 'Saving...' : 'Save settings'}
                </Button>
                {updateProfile.isError && (
                  <p className="mt-2 text-xs text-warning-flare">
                    Failed to save settings. Please try again.
                  </p>
                )}
              </div>
            </section>

            {/* ACCOUNT section */}
            <section className="pb-12">
              <div className="border-t border-surface-steel pb-2 pt-4">
                <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
                  ACCOUNT
                </h2>
              </div>

              <div className="mt-4">
                {auth.isGuest ? (
                  <div className="space-y-3">
                    <Link to="/sign-up">
                      <Button className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80">
                        Create account
                      </Button>
                    </Link>
                    <p className="text-center text-xs text-warm-ash">
                      Sign up to sync your data across devices and back up your training history.
                    </p>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="min-h-[48px] w-full border-surface-steel text-warning-flare hover:bg-surface-gunmetal"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </Button>
                    {signOutError && (
                      <p className="mt-2 text-xs text-warning-flare">{signOutError}</p>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Right column: current maxes */}
          <div>
            <section className="pb-8">
              <div className="border-t border-surface-steel pb-2 pt-4">
                <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
                  CURRENT MAXES
                </h2>
              </div>

              <div className="mt-4">
                <OneRmManagement
                  userId={userId}
                  exerciseMaxes={profile?.exerciseMaxes ?? {}}
                  preferredUnits={profile?.preferredUnits ?? 'IMPERIAL'}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useUserProfile, useUpdateUserProfile } from '@/hooks/use-user-profile'
import { Button } from '@/components/ui/button'
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
    } catch {
      // Error state available via updateProfile.isError
    }
  }

  const handleSignOut = async () => {
    const { error } = await auth.signOut()
    if (error) {
      console.error('[auth] Sign out failed:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-pit px-4 py-8">
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-pit px-4">
        <span className="material-symbols-outlined mb-3 text-4xl text-warning-flare">
          cloud_off
        </span>
        <p className="font-display text-sm uppercase tracking-widest text-warning-flare">
          FAILED TO LOAD PROFILE
        </p>
        <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-pit">
      {/* Page header */}
      <div className="px-4 pt-8 pb-6">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-bone-white">
          PROFILE
        </h1>
      </div>

      {/* SETTINGS section */}
      <section className="px-4 pb-8">
        <div className="border-t border-surface-steel pb-2 pt-4">
          <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
            SETTINGS
          </h2>
        </div>

        <div className="mt-4 space-y-6">
          {/* Display name */}
          <div className="space-y-1">
            <label className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
              DISPLAY NAME
            </label>
            <input
              type="text"
              value={effectiveDisplayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter display name"
              className="w-full border-b-2 border-surface-steel bg-transparent px-0 py-2 font-body text-base text-bone-white outline-none transition-colors placeholder:text-surface-steel focus:border-ember"
            />
          </div>

          {/* Bodyweight */}
          <div className="space-y-1">
            <label className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
              BODYWEIGHT
            </label>
            <div className="flex items-end gap-3">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={effectiveBodyweight}
                onChange={(e) => setBodyweight(e.target.value)}
                placeholder="0"
                className="flex-1 border-b-2 border-surface-steel bg-transparent px-0 py-2 font-display text-2xl text-bone-white outline-none transition-colors placeholder:text-surface-steel focus:border-ember"
              />
              <span className="pb-2 font-sans text-sm uppercase text-warm-ash">
                {bodyweightUnit}
              </span>
            </div>
          </div>

          {/* Preferred units */}
          <div className="space-y-2">
            <label className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
              PREFERRED UNITS
            </label>
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
                className="min-h-[48px] flex-1 font-sans text-xs font-medium uppercase tracking-widest data-[state=on]:bg-forge data-[state=on]:text-on-forge"
              >
                IMPERIAL
              </ToggleGroupItem>
              <ToggleGroupItem
                value="METRIC"
                className="min-h-[48px] flex-1 font-sans text-xs font-medium uppercase tracking-widest data-[state=on]:bg-forge data-[state=on]:text-on-forge"
              >
                METRIC
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Save settings button */}
          <Button
            className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
            onClick={handleSaveSettings}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? 'SAVING...' : 'SAVE SETTINGS'}
          </Button>
          {updateProfile.isError && (
            <p className="mt-2 text-xs text-warning-flare">
              Failed to save settings. Please try again.
            </p>
          )}
        </div>
      </section>

      {/* CURRENT MAXES section */}
      <section className="px-4 pb-8">
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

      {/* ACCOUNT section */}
      <section className="px-4 pb-12">
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
                  CREATE ACCOUNT
                </Button>
              </Link>
              <p className="text-xs text-warm-ash text-center">
                Sign up to sync your data across devices and back up your training history.
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              className="min-h-[48px] w-full border-surface-steel text-warning-flare hover:bg-surface-gunmetal"
              onClick={handleSignOut}
            >
              SIGN OUT
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

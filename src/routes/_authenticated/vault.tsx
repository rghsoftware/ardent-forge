import { createFileRoute } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VaultOverview } from '@/components/vault/vault-overview'
import { VaultOneRmTab } from '@/components/vault/vault-one-rm-tab'
import { VaultVolumeTab } from '@/components/vault/vault-volume-tab'

export const Route = createFileRoute('/_authenticated/vault')({
  component: VaultPage,
})

function VaultPage() {
  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      {/* Header */}
      <div className="mx-auto max-w-5xl flex items-center gap-3 px-4 pt-6 pb-4 md:px-6 lg:px-8">
        <span className="material-symbols-outlined text-2xl text-warm-ash">monitoring</span>
        <h1 className="font-display text-industrial text-2xl text-bone-white">VAULT</h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
        <TabsList
          variant="line"
          className="w-full justify-start border-b border-b-[rgba(91,64,57,0.15)]"
        >
          <TabsTrigger
            value="overview"
            className="min-h-12 font-body text-xs font-medium uppercase tracking-widest data-[state=active]:text-ember"
          >
            OVERVIEW
          </TabsTrigger>
          <TabsTrigger
            value="one-rm"
            className="min-h-12 font-body text-xs font-medium uppercase tracking-widest data-[state=active]:text-ember"
          >
            1RM TRENDS
          </TabsTrigger>
          <TabsTrigger
            value="volume"
            className="min-h-12 font-body text-xs font-medium uppercase tracking-widest data-[state=active]:text-ember"
          >
            VOLUME
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="overflow-y-auto pb-24">
          <VaultOverview />
        </TabsContent>

        <TabsContent value="one-rm" className="overflow-y-auto pb-24">
          <VaultOneRmTab />
        </TabsContent>

        <TabsContent value="volume" className="overflow-y-auto pb-24">
          <VaultVolumeTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

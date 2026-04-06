import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { HelpTrigger } from '@/components/ui/help-trigger'
import { BLOCK_TYPE_HELP } from '@/components/builders/help-content'
import { BLOCK_TYPES } from './constants'
import type { BlockType } from '@/domain/types'

interface BlockTypeSelectorProps {
  value: BlockType
  onChange: (blockType: BlockType) => void
}

export function BlockTypeSelector({ value, onChange }: BlockTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-warm-ash/60">Block type</span>
        <HelpTrigger
          title="Block Types"
          content={
            <div className="space-y-3">
              {Object.values(BLOCK_TYPE_HELP).map((bt) => (
                <div key={bt.label}>
                  <p className="font-heading text-xs font-medium text-bone-white">{bt.label}</p>
                  <p className="text-xs text-warm-ash">{bt.description}</p>
                </div>
              ))}
            </div>
          }
        />
      </div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as BlockType)
        }}
        className="flex flex-wrap gap-1"
      >
        {BLOCK_TYPES.map((bt) => (
          <ToggleGroupItem
            key={bt.value}
            value={bt.value}
            className="min-h-8 px-2 py-1 text-xs font-medium uppercase tracking-wider"
          >
            {bt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="mt-1 font-body text-xs text-warm-ash">{BLOCK_TYPE_HELP[value].oneLiner}</p>
    </div>
  )
}

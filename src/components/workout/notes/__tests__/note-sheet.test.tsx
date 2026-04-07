// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteSheet } from '@/components/workout/notes/note-sheet'
import { NoteTagPicker } from '@/components/workout/notes/note-tag-picker'
import { useRecentTagsStore } from '@/stores/recent-tags-store'
import type { NoteContent } from '@/domain/types'
import { useState } from 'react'

beforeEach(() => {
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear()
  }
  useRecentTagsStore.setState({ recent: [] })
})

function Harness(props: {
  initial?: NoteContent
  onChange?: (next: NoteContent) => void
  startOpen?: boolean
}) {
  const [open, setOpen] = useState(props.startOpen ?? true)
  const [value, setValue] = useState<NoteContent>(props.initial ?? { text: '', tags: [] })
  return (
    <NoteSheet
      open={open}
      onOpenChange={setOpen}
      value={value}
      onChange={(next) => {
        setValue(next)
        props.onChange?.(next)
      }}
      level="set"
    />
  )
}

describe('NoteSheet autosave semantics', () => {
  it('does NOT call onChange on every keystroke', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const textarea = screen.getByLabelText(/Set Note text/i)
    await user.type(textarea, 'grindy')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange on textarea blur with the current draft', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const textarea = screen.getByLabelText(/Set Note text/i)
    await user.type(textarea, 'grindy')
    await user.tab() // blur

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ text: 'grindy', tags: [] })
  })

  it('calls onChange immediately on tag toggle (discrete event)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    // FORM BREAKDOWN is one of the starter tags
    const chip = screen.getByRole('button', { name: /FORM BREAKDOWN/ })
    await user.click(chip)

    expect(onChange).toHaveBeenCalledTimes(1)
    const [payload] = onChange.mock.calls[0]
    expect(payload.tags).toContain('FORM BREAKDOWN')
  })
})

describe('NoteTagPicker', () => {
  it('places recently-used tags before starter tags', async () => {
    useRecentTagsStore.setState({ recent: ['CUSTOM PIN'] })

    const user = userEvent.setup()
    const onChange = vi.fn()
    function Wrapper() {
      const [selected, setSelected] = useState<string[]>([])
      return (
        <NoteTagPicker
          selected={selected}
          onChange={(next) => {
            setSelected(next)
            onChange(next)
          }}
        />
      )
    }
    render(<Wrapper />)

    const chipButtons = screen
      .getAllByRole('button')
      .filter((b) => !/new tag|add|cancel/i.test(b.textContent ?? ''))
    // First chip should be the recent one
    expect(chipButtons[0]).toHaveTextContent('CUSTOM PIN')
    // FORM BREAKDOWN (first starter) must come after the recent entry
    const idxRecent = chipButtons.findIndex((b) => b.textContent?.includes('CUSTOM PIN'))
    const idxStarter = chipButtons.findIndex((b) => b.textContent?.includes('FORM BREAKDOWN'))
    expect(idxRecent).toBeLessThan(idxStarter)

    await user.click(chipButtons[0])
    expect(onChange).toHaveBeenCalledWith(['CUSTOM PIN'])
  })

  it('creates a new tag via the "+ NEW TAG" affordance and persists to recents', async () => {
    const user = userEvent.setup()
    function Wrapper() {
      const [selected, setSelected] = useState<string[]>([])
      return <NoteTagPicker selected={selected} onChange={setSelected} />
    }
    render(<Wrapper />)

    await user.click(screen.getByRole('button', { name: /create a new tag/i }))
    const input = screen.getByLabelText(/New tag name/i)
    await user.type(input, 'bar path')
    await user.click(screen.getByRole('button', { name: /^Add$/ }))

    // New tag rendered as a selected chip (uppercase normalized)
    expect(screen.getByRole('button', { name: /BAR PATH/ })).toHaveAttribute('aria-pressed', 'true')
    // Recent-tags store now contains it
    expect(useRecentTagsStore.getState().recent).toContain('BAR PATH')
  })
})

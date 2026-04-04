// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DisplayModeTransition } from '../display-mode-transition'

describe('DisplayModeTransition', () => {
  it('idle-to-board transition uses duration-300 fade classes (no zoom)', () => {
    const { container } = render(
      <DisplayModeTransition mode="board" previousMode="idle">
        <span>content</span>
      </DisplayModeTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toBe('animate-in fade-in-0 duration-300')
  })

  it('board-to-idle transition uses duration-300 fade classes (no zoom)', () => {
    const { container } = render(
      <DisplayModeTransition mode="idle" previousMode="board">
        <span>content</span>
      </DisplayModeTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toBe('animate-in fade-in-0 duration-300')
  })

  it('board-to-focused transition uses duration-[400ms] zoom+fade classes', () => {
    const { container } = render(
      <DisplayModeTransition mode="focused" previousMode="board">
        <span>content</span>
      </DisplayModeTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toBe(
      'animate-in zoom-in-95 fade-in-0 duration-[400ms]',
    )
  })

  it('focused-to-board transition uses duration-[400ms] zoom+fade classes', () => {
    const { container } = render(
      <DisplayModeTransition mode="board" previousMode="focused">
        <span>content</span>
      </DisplayModeTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toBe(
      'animate-in zoom-in-95 fade-in-0 duration-[400ms]',
    )
  })

  it('null previousMode (initial render) returns default fade duration-300 classes', () => {
    const { container } = render(
      <DisplayModeTransition mode="board" previousMode={null}>
        <span>content</span>
      </DisplayModeTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toBe('animate-in fade-in-0 duration-300')
  })

  it('idle-to-focused (skip board) returns default fade duration-300 classes', () => {
    const { container } = render(
      <DisplayModeTransition mode="focused" previousMode="idle">
        <span>content</span>
      </DisplayModeTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toBe('animate-in fade-in-0 duration-300')
  })

  it('renders children correctly', () => {
    render(
      <DisplayModeTransition mode="board" previousMode={null}>
        <span data-testid="child">Hello</span>
      </DisplayModeTransition>,
    )
    expect(screen.getByTestId('child')).toHaveTextContent('Hello')
  })

  it('wrapper div has correct className from getTransitionClasses', () => {
    const { container } = render(
      <DisplayModeTransition mode="focused" previousMode="board">
        <span>content</span>
      </DisplayModeTransition>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.className).toContain('animate-in')
    expect(wrapper.className).toContain('zoom-in-95')
    expect(wrapper.className).toContain('fade-in-0')
    expect(wrapper.className).toContain('duration-[400ms]')
  })
})

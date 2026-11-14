'use client'

import type { ComponentProps } from 'react'
import { CheckboxCards, RadioCards } from './themes'

type LayoutProps = { layout?: 'flow' | 'equal' }

type RadioProps = LayoutProps & Omit<ComponentProps<typeof RadioCards.Root>, 'columns' | 'className' | 'style'>
type CheckboxProps = LayoutProps & Omit<ComponentProps<typeof CheckboxCards.Root>, 'columns' | 'className' | 'style'>

/** Content-width choices that wrap, while retaining Radix selection and keyboard behavior. */
export function FlowRadioCards({ size = '2', layout = 'flow', ...props }: RadioProps) {
  return <RadioCards.Root {...props} size={size} data-layout={layout} className="rosie-flow-choice-cards" />
}
export function FlowCheckboxCards({ size = '2', layout = 'flow', ...props }: CheckboxProps) {
  return <CheckboxCards.Root {...props} size={size} data-layout={layout} className="rosie-flow-choice-cards" />
}

import {
  easeOutQuint,
  easeOutSoft,
  gentleMaskReveal,
  itemReveal,
  listStagger,
  luxuriousSpring,
  panelTransition,
  sectionReveal,
  shellStagger,
  springTransition,
} from './presets'

describe('motion presets', () => {
  test('exposes spring transitions used by the UI shell', () => {
    expect(springTransition).toMatchObject({
      type: 'spring',
      stiffness: 240,
      damping: 24,
      mass: 0.8,
    })

    expect(panelTransition).toMatchObject({
      type: 'spring',
      stiffness: 180,
      damping: 24,
      mass: 0.9,
    })

    expect(luxuriousSpring).toMatchObject({
      type: 'spring',
      stiffness: 150,
      damping: 22,
      mass: 1.02,
    })
  })

  test('defines easing arrays and animation variants for reveals', () => {
    expect(easeOutQuint).toEqual([0.22, 1, 0.36, 1])
    expect(easeOutSoft).toEqual([0.16, 1, 0.3, 1])

    expect(shellStagger).toHaveProperty('visible.transition.staggerChildren', 0.08)
    expect(sectionReveal).toHaveProperty('hidden.filter', 'blur(18px)')
    expect(listStagger).toHaveProperty('visible.transition.delayChildren', 0.04)
    expect(itemReveal).toHaveProperty('visible.transition.duration', 0.42)
    expect(gentleMaskReveal).toHaveProperty('hidden.scale', 0.985)
  })
})

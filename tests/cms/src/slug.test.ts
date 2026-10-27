import { slugField, toSlug } from '@cms/lib/slug'

describe('slugs', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['  Café crème — déjà vu!  ', 'cafe-creme-deja-vu'],
    ['already-a-slug', 'already-a-slug'],
    ['Q3 2026: Results & Plans', 'q3-2026-results-plans'],
    ['---', ''],
  ])('%p → %p', (input, expected) => {
    expect(toSlug(input)).toBe(expected)
  })

  it('caps length at 96', () => {
    expect(toSlug('a'.repeat(200))).toHaveLength(96)
  })

  it('derives from the source field unless an editor set one', () => {
    const field = slugField('title') as { unique: boolean; index: boolean; hooks: { beforeValidate: Array<(a: unknown) => unknown> } }
    expect(field.unique).toBe(true)
    expect(field.index).toBe(true)
    const hook = field.hooks.beforeValidate[0]!
    expect(hook({ value: undefined, data: { title: 'My First Post' } })).toBe('my-first-post')
    expect(hook({ value: 'Custom Slug', data: { title: 'ignored' } })).toBe('custom-slug')
    expect(hook({ value: '', data: { title: 'From Title' } })).toBe('from-title')
    expect(hook({ value: undefined, data: {} })).toBeUndefined()
  })
})

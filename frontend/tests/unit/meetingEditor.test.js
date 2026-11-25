import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { H1 } from 'frappe-ui/editor'
import {
  buildEditorExtensions,
  formToolbar,
  meetingToolbar,
} from '@/components/editor/config'

describe('meeting editor headings', () => {
  it('supports H1 in meeting fields without changing the standard toolbar', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions({ allowHeading1: true }),
      content: '<p>Meeting agenda</p>',
    })
    expect(editor.commands.setHeading({ level: 1 })).toBe(true)
    const output = document.createElement('div')
    output.innerHTML = editor.getHTML()
    expect(output.querySelector('h1')?.textContent).toBe('Meeting agenda')
    expect(meetingToolbar.find((item) => item.type === 'group').items).toContain(H1)
    expect(formToolbar.find((item) => item.type === 'group').items).not.toContain(H1)
    editor.destroy()
  })
})

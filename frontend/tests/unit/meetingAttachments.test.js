import { describe, expect, it } from 'vitest'
import { getMeetingAttachmentTarget } from '@/utils/meetingAttachments'

describe('meeting attachment target', () => {
  it('prioritizes deal, then lead, then organization', () => {
    expect(
      getMeetingAttachmentTarget({
        deal: 'DEAL-1',
        lead: 'LEAD-1',
        organization: 'ORG-1',
      }),
    ).toEqual({ doctype: 'CRM Deal', docname: 'DEAL-1' })
    expect(
      getMeetingAttachmentTarget({ lead: 'LEAD-1', organization: 'ORG-1' }),
    ).toEqual({ doctype: 'CRM Lead', docname: 'LEAD-1' })
    expect(getMeetingAttachmentTarget({ organization: 'ORG-1' })).toEqual({
      doctype: 'CRM Organization',
      docname: 'ORG-1',
    })
  })

  it('attaches standalone meeting files to the saved meeting', () => {
    expect(getMeetingAttachmentTarget({ name: 'MOM-001' })).toEqual({
      doctype: 'CRM Meeting Minutes',
      docname: 'MOM-001',
    })
  })

  it('does not attach files until a saved target exists', () => {
    expect(getMeetingAttachmentTarget({})).toBeNull()
  })
})

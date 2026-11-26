export function getMeetingAttachmentTarget(doc) {
  if (doc?.deal) {
    return { doctype: 'CRM Deal', docname: doc.deal }
  }
  if (doc?.lead) {
    return { doctype: 'CRM Lead', docname: doc.lead }
  }
  if (doc?.organization) {
    return { doctype: 'CRM Organization', docname: doc.organization }
  }
  if (doc?.name) {
    return { doctype: 'CRM Meeting Minutes', docname: doc.name }
  }
  return null
}

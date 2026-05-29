export function newElementId(): string {
  return `el_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export function newPageId(): string {
  return `pg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export function newTemplateId(): string {
  return `tpl_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

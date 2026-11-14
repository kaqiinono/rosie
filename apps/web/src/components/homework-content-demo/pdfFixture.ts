/** Four original vector pages. ASCII content keeps byte offsets deterministic. */
export function makeGardenPdf(): Blob {
  const captions = ['A Little Garden', 'Rosie waters the flowers.', 'A bird sits in the tree.', 'The garden grows every day.']
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R 10 0 R] /Count 4 >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  captions.forEach((caption, i) => {
    const content = `0.99 0.96 0.88 rg 0 0 450 600 re f\n0.18 0.22 0.16 rg BT /F1 24 Tf 35 530 Td (${caption}) Tj ET\n0.32 0.7 0.45 rg 40 80 370 140 re f\n0.5 0.31 0.19 rg 300 160 24 160 re f\n0.24 0.6 0.35 rg 250 290 125 90 re f\n0.95 0.65 0.16 rg 110 220 45 45 re f\n0.2 0.35 0.2 rg 130 160 6 60 re f\n0.18 0.22 0.16 rg BT /F1 14 Tf 35 40 Td (Original demo - page ${i + 1}) Tj ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 450 600] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`)
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n` })
  const start = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`
  return new Blob([pdf], { type: 'application/pdf' })
}

import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'

import { LmsError, verifyCertificate } from '../../../../lms/services'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Certificate' }

// Public and printable: anyone with the link can check what it certifies.
export default async function CertificatePage({ params, searchParams }: { params: Promise<{ serial: string }>; searchParams: Promise<{ new?: string }> }) {
  const { serial } = await params
  const { new: fresh } = await searchParams
  const payload = await getPayload({ config })
  let cert
  try {
    cert = await verifyCertificate(payload, decodeURIComponent(serial))
  } catch (err) {
    if (err instanceof LmsError) notFound()
    throw err
  }
  const issued = new Date(cert.issuedAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  return (
    <div data-page="certificate">
      {fresh ? (
        <p className="notice ok noprint" role="status">
          Congratulations, you completed the course. Share this page: anyone can verify it.
        </p>
      ) : null}
      <section className="cert" aria-labelledby="cert-title">
        <p className="kicker" id="cert-title">
          Certificate of completion
        </p>
        <p className="name">{cert.learner}</p>
        <p>has completed</p>
        <p className="course">
          <strong>{cert.course}</strong>
          <br />
          {cert.academy}
        </p>
        <p className="meta" style={{ justifyContent: 'center' }}>
          <span>Issued {issued}</span>
          <span className="serial">No. {cert.serial}</span>
        </p>
      </section>
      <div className="actions noprint" style={{ justifyContent: 'center' }}>
        <a className="btn secondary" href="/me">
          My learning
        </a>
      </div>
    </div>
  )
}

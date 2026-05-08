'use client'

import { useState, useEffect, useRef } from 'react'

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

// ✅ Hanya ekspedisi terdaftar
const OUR_EKSPEDISI = [
  { kode: 'LION',   label: 'Lion Parcel',   color: '#f97316', match: ['lion'] },
  { kode: 'JNE',    label: 'JNE Express',   color: '#ef4444', match: ['jne'] },
  { kode: 'WAHANA', label: 'Wahana Express', color: '#3b82f6', match: ['wahana'] },
]

function matchEkspedisi(courierCode: string) {
  const code = courierCode.toLowerCase()
  return OUR_EKSPEDISI.find(e => e.match.some(m => code.includes(m)))
}

type Village = {
  village_code: string
  village: string
  district: string
  city: string
  province: string
}

type CourierRate = {
  courier_code: string
  courier_name: string
  price: number
  weight: number
  estimation: string
}

type GroupedResult = {
  ekspedisi: typeof OUR_EKSPEDISI[0]
  products: CourierRate[]
  cheapest: number
}

function VillageSearch({
  label, value, onChange, placeholder,
}: {
  label: string
  value: Village | null
  onChange: (v: Village) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Village[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function onInput(q: string) {
    setQuery(q)
    clearTimeout(timer.current)
    if (q.length < 3) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/ongkir/villages?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setOpen(true)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 400)
  }

  function select(v: Village) {
    onChange(v)
    setQuery(`${v.village}, ${v.district}, ${v.city}`)
    setOpen(false)
    setResults([])
  }

  const inp: React.CSSProperties = {
    width: '100%', background: '#0d111c', border: '1px solid #1e2433',
    borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: 13,
    boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        style={inp}
        value={query}
        onChange={e => onInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <div style={{ position: 'absolute', right: 12, top: 38, fontSize: 11, color: '#475569' }}>Mencari...</div>
      )}
      {value && query && (
        <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>
          ✓ {value.village}, {value.district}, {value.city} ({value.village_code})
        </div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#111827', border: '1px solid #1e2433', borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 240, overflowY: 'auto',
          marginTop: 4,
        }}>
          {results.map(v => (
            <div
              key={v.village_code}
              onClick={() => select(v)}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #1e2433' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e2433')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{v.village}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {v.district} · {v.city} · {v.province}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OngkirClient() {
  const [origin, setOrigin] = useState<Village | null>(null)
  const [destination, setDestination] = useState<Village | null>(null)

  // ✅ Input berat & dimensi
  const [beratAktual, setBeratAktual] = useState('1')
  const [panjang, setPanjang] = useState('')
  const [lebar, setLebar] = useState('')
  const [tinggi, setTinggi] = useState('')

  const [loading, setLoading] = useState(false)
  const [grouped, setGrouped] = useState<GroupedResult[] | null>(null)
  const [beratTagihan, setBeratTagihan] = useState<number>(0)
  const [error, setError] = useState('')

  // ✅ Hitung berat volumetrik secara real-time
  const beratVolumetrik = (panjang && lebar && tinggi)
    ? Math.ceil((Number(panjang) * Number(lebar) * Number(tinggi)) / 5000 * 10) / 10
    : 0

  const beratEfektif = Math.max(Number(beratAktual) || 0, beratVolumetrik)

  async function cekOngkir(e: React.FormEvent) {
    e.preventDefault()
    if (!origin || !destination) { setError('Pilih kelurahan asal dan tujuan'); return }
    if (!beratAktual || Number(beratAktual) <= 0) { setError('Berat harus lebih dari 0'); return }

    setLoading(true); setError(''); setGrouped(null)

    try {
      const res = await fetch(
        `/api/ongkir/check?origin=${origin.village_code}&destination=${destination.village_code}&weight=${beratEfektif}`
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Gagal cek ongkir'); return }

      const allCouriers: CourierRate[] = data.couriers || []

      // ✅ Filter hanya ekspedisi kita, group by ekspedisi
      const groupMap: Record<string, GroupedResult> = {}
      OUR_EKSPEDISI.forEach(e => {
        groupMap[e.kode] = { ekspedisi: e, products: [], cheapest: Infinity }
      })

      allCouriers.forEach((c: CourierRate) => {
        const eks = matchEkspedisi(c.courier_code)
        if (!eks) return
        groupMap[eks.kode].products.push(c)
        if (c.price < groupMap[eks.kode].cheapest) {
          groupMap[eks.kode].cheapest = c.price
        }
      })

      // Hanya tampilkan yang punya produk
      const result = OUR_EKSPEDISI
        .map(e => groupMap[e.kode])
        .filter(g => g.products.length > 0)

      setGrouped(result)
      setBeratTagihan(beratEfektif)
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }

  const globalCheapest = grouped
    ? Math.min(...grouped.flatMap(g => g.products.map(p => p.price)))
    : 0

  const inp: React.CSSProperties = {
    width: '100%', background: '#0d111c', border: '1px solid #1e2433',
    borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: 13,
    boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Cek Ongkir</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
          Bandingkan tarif pengiriman ekspedisi kami
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Form ── */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>🔍 Parameter Pengiriman</div>
          <form onSubmit={cekOngkir} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <VillageSearch label="Kelurahan Asal *" value={origin} onChange={setOrigin} placeholder="Ketik nama kelurahan asal..." />

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button type="button"
                onClick={() => { const tmp = origin; setOrigin(destination); setDestination(tmp) }}
                style={{ background: '#1e2433', border: '1px solid #2d3748', borderRadius: 8, padding: '6px 16px', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                ⇅ Tukar Asal & Tujuan
              </button>
            </div>

            <VillageSearch label="Kelurahan Tujuan *" value={destination} onChange={setDestination} placeholder="Ketik nama kelurahan tujuan..." />

            {/* ✅ Berat aktual */}
            <div>
              <label style={lbl}>Berat Aktual (kg) *</label>
              <input type="number" min="0.1" step="0.1" value={beratAktual}
                onChange={e => setBeratAktual(e.target.value)} style={inp} />
            </div>

            {/* ✅ Dimensi paket */}
            <div>
              <label style={lbl}>Dimensi Paket (cm) — opsional</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Panjang', val: panjang, set: setPanjang },
                  { label: 'Lebar',   val: lebar,   set: setLebar },
                  { label: 'Tinggi',  val: tinggi,  set: setTinggi },
                ].map(d => (
                  <div key={d.label}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{d.label}</div>
                    <input type="number" min="0" step="1" value={d.val}
                      onChange={e => d.set(e.target.value)}
                      placeholder="cm"
                      style={inp} />
                  </div>
                ))}
              </div>
            </div>

            {/* ✅ Info berat volumetrik */}
            {beratVolumetrik > 0 && (
              <div style={{ background: '#1e2433', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#64748b' }}>Berat aktual</span>
                  <span style={{ color: '#94a3b8' }}>{beratAktual} kg</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#64748b' }}>Berat volumetrik</span>
                  <span style={{ color: '#94a3b8' }}>
                    {panjang}×{lebar}×{tinggi} / 5000 = {beratVolumetrik} kg
                  </span>
                </div>
                <div style={{ borderTop: '1px solid #2d3748', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#f1f5f9', fontWeight: 700 }}>Berat tagihan</span>
                  <span style={{ color: beratVolumetrik > Number(beratAktual) ? '#f97316' : '#22c55e', fontWeight: 700 }}>
                    {beratEfektif} kg {beratVolumetrik > Number(beratAktual) ? '(volumetrik)' : '(aktual)'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading || !origin || !destination}>
              {loading ? '⏳ Mengecek...' : '🔍 Cek Ongkir Sekarang'}
            </button>
          </form>
        </div>

        {/* ── Hasil ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {!grouped && !loading && (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Masukkan alamat asal & tujuan</div>
              <div style={{ fontSize: 13 }}>Tarif Lion Parcel, JNE, dan Wahana akan muncul di sini</div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 14 }}>Mengambil tarif ekspedisi...</div>
            </div>
          )}

          {grouped && (
            <>
              {/* Summary route */}
              <div className="card" style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{origin?.village}, {origin?.city}</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{destination?.village}, {destination?.city}</span>
                    <span style={{ margin: '0 8px', color: '#475569' }}>·</span>
                    <span>{beratTagihan} kg</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Mulai dari <b style={{ color: '#22c55e' }}>{fmt(globalCheapest)}</b>
                  </div>
                </div>
              </div>

              {/* ✅ Kartu per ekspedisi */}
              {grouped.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: '#475569' }}>
                  Tidak ada tarif tersedia untuk rute ini dari ekspedisi kami.
                </div>
              ) : grouped.map(g => (
                <div key={g.ekspedisi.kode} className="card" style={{ padding: 20, border: `1px solid ${g.ekspedisi.color}25` }}>
                  {/* Header ekspedisi */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        background: `${g.ekspedisi.color}25`, color: g.ekspedisi.color,
                        border: `1px solid ${g.ekspedisi.color}50`,
                        padding: '3px 12px', borderRadius: 6, fontSize: 13, fontWeight: 800,
                      }}>{g.ekspedisi.kode}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{g.ekspedisi.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {g.products.length} layanan · mulai{' '}
                      <span style={{ color: g.ekspedisi.color, fontWeight: 700 }}>{fmt(g.cheapest)}</span>
                    </div>
                  </div>

                  {/* Grid produk */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                    {g.products
                      .sort((a, b) => a.price - b.price)
                      .map(p => {
                        const isCheapestGlobal = p.price === globalCheapest
                        const isCheapestEks = p.price === g.cheapest
                        return (
                          <div key={p.courier_code} style={{
                            background: isCheapestGlobal ? `${g.ekspedisi.color}18` : '#0d111c',
                            border: `1px solid ${isCheapestGlobal ? g.ekspedisi.color + '50' : '#1e2433'}`,
                            borderRadius: 8, padding: '12px 14px',
                            position: 'relative',
                          }}>
                            {isCheapestGlobal && (
                              <div style={{
                                position: 'absolute', top: -8, right: 8,
                                background: '#22c55e', color: '#fff',
                                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                              }}>TERMURAH</div>
                            )}
                            {/* Nama layanan — ambil bagian setelah nama ekspedisi */}
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                              {p.courier_name
                                .replace(/lion parcel/i, '')
                                .replace(/jne/i, '')
                                .replace(/wahana/i, '')
                                .trim() || p.courier_name}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: isCheapestEks ? g.ekspedisi.color : '#f97316', marginBottom: 4 }}>
                              {fmt(p.price)}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              ⏱ {p.estimation || '—'}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
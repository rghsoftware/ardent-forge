import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_PUB_KEY

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Discovery not configured' })
    return
  }

  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({
    version: '1',
    supabase_url: supabaseUrl,
    supabase_publishable_key: supabaseKey,
  })
}

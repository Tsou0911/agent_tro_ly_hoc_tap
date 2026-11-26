import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Thiếu ${name} trong .env.local.`)
  return value
}

// Một bộ dữ liệu riêng cho mỗi giáo viên, giữ nguyên ID khi chạy lại.
function seedId(teacher: string, label: string) {
  const hex = createHash('sha256').update(`LinguaCompanion:${teacher}:${label}`).digest('hex')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`
}

async function seed() {
  const supabase = createClient<Database>(required('NEXT_PUBLIC_SUPABASE_URL'),required('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  const { data, error } = await supabase.auth.signInWithPassword({
    email: required('SEED_TEACHER_EMAIL'), password: required('SEED_TEACHER_PASSWORD')
  })
  if (error) throw error
  const teacher = data.user.id
  const { data: profile } = await supabase.from('profiles').select('role').eq('id',teacher).single().throwOnError()
  if (profile.role !== 'teacher') throw new Error('Seed cần tài khoản đã xác nhận với vai trò giáo viên.')
  const groupId = seedId(teacher,'english-class')
  const { data: existing } = await supabase.from('groups').select('join_code').eq('id',groupId).maybeSingle().throwOnError()
  const group = existing ?? (await supabase.from('groups').insert({
    id: groupId, teacher_id: teacher, name: 'English Café', language: 'English'
  }).select('join_code').single().throwOnError()).data

  const aimId = seedId(teacher,'cafe-week')
  const start = new Date()
  const end = new Date(start.getTime() + 6 * 86400000)
  const date = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  await supabase.from('aims').upsert({
    id: aimId, group_id: groupId, title: 'Gọi món và phản hồi lịch sự',
    start_date: date(start), end_date: date(end), target_listening: 2, target_speaking_mins: 5, target_writing: 1
  }, { onConflict: 'id', ignoreDuplicates: true }).throwOnError()

  const filename = 'cafe-phrases.txt'
  const path = `${groupId}/${filename}`
  const { data: saved } = await supabase.from('materials').select('id').eq('file_url',path).maybeSingle().throwOnError()
  if (!saved) {
    const chunks = [
      'Ordering at a café: “Could I have a cup of tea, please?” is a polite way to place an order. The server might ask, “For here or to go?”',
      'Asking for clarification: “Could you repeat that, please?” invites the speaker to say something again. “Did you say iced tea?” checks what you heard.'
    ]
    const bucket = supabase.storage.from('materials')
    const objects = await bucket.list(groupId,{ search: filename })
    if (objects.error) throw objects.error
    if (!objects.data.some(object => object.name === filename)) {
      const upload = await bucket.upload(path,Buffer.from(chunks.join('\n\n')),{ contentType: 'text/plain' })
      if (upload.error) throw upload.error
    }
    await supabase.rpc('save_material',{ p_group_id: groupId, p_title: filename, p_file_url: path, p_file_type: 'text/plain', p_chunks: chunks }).throwOnError()
  }
  console.log(`Lớp English Café đã sẵn sàng. Mã tham gia: ${group.join_code}`)
}

seed().catch(error => {
  console.error(error?.message ?? 'Seed thất bại.')
  process.exitCode = 1
})

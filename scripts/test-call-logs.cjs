const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const assistantId = '22222222-2222-2222-2222-222222222222'
const source = fs.readFileSync('src/app/api/call-logs/route.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

async function run(method, query, body, settings = {}) {
  const calls = []
  const db = {
    from(table) {
      const call = { table, filters: [], values: null, operation: 'select' }
      calls.push(call)
      const result = () => ({ data: settings.missing ? null : { id: assistantId }, error: null })
      const builder = {
        select(columns, options) { call.columns = columns; call.options = options; return builder },
        eq(key, value) { call.filters.push([key, value]); return builder },
        ilike(key, value) { call.filters.push([key, value]); return builder },
        is(key, value) { call.filters.push([key, value]); return builder },
        order(key, options) { (call.orders ??= []).push([key, options]); return builder },
        range(start, end) {
          call.range = [start, end]
          const rows = settings.empty ? [] : [
            ...Array.from({ length: 1000 }, () => ({ call_type: 'incoming', duration_seconds: 1 })),
            { call_type: 'outgoing', duration_seconds: 60 },
            { call_type: 'missed', duration_seconds: 0 },
            { call_type: 'rejected', duration_seconds: 10 },
            { call_type: 'blocked', duration_seconds: 5 },
          ]
          return Promise.resolve({ data: call.columns === 'call_type, duration_seconds' ? rows.slice(start, end + 1) : [], count: settings.empty ? 0 : 123, error: settings.dbError ? new Error('Database failure') : null })
        },
        maybeSingle() { return Promise.resolve(result()) },
        single() {
          return Promise.resolve({
            data: settings.notFound ? null : { id: '11111111-1111-4111-8111-111111111111', ...(call.values ?? {}) },
            error: settings.notFound ? { message: 'not found', code: 'PGRST116' } : null,
          })
        },
        insert(values) { call.operation = 'insert'; call.values = values; return builder },
        update(values) { call.operation = 'update'; call.values = values; return builder },
        delete() { call.operation = 'delete'; return builder },
      }
      return builder
    },
  }
  const modules = {
    'next/server': { NextResponse: { json: (data, options) => ({ ...data, status: options?.status ?? 200 }) } },
    '@/lib/supabase/server': { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: settings.anonymous ? null : { id: 'user' } } }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { system_role: settings.role ?? 'admin' } }) }) }) }),
    }) },
    '@/lib/supabase/admin': { getServiceClient: () => db },
    '@/lib/auth': { isAllowedRole: role => ['admin', 'owner'].includes(role) },
    '@/lib/message-status': {
      MESSAGE_STATUSES: ['called', 'message_sent', 'call_later', 'rejected', 'complete'],
      isMessageStatus: value => ['called', 'message_sent', 'call_later', 'rejected', 'complete'].includes(value),
    },
  }
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: name => modules[name], console })
  const response = await exports[method]({ nextUrl: new URL(`https://example.test/api/sales-assistants?${query}`), json: async () => body })
  return { response, calls }
}

async function main() {
  for (const settings of [{ anonymous: true }, { role: 'member' }]) {
    const result = await run('GET', '', null, settings)
    assert.equal(result.response.status, settings.anonymous ? 401 : 403)
    assert.equal(result.calls.length, 0)
  }
  for (const query of ['', 'page=1', 'page=2']) {
    const result = await run('GET', query)
    assert.equal(result.response.status, 200)
    assert.equal(result.response.total, 123)
    assert.equal(result.response.pageSize, 50)
    assert.equal(result.response.statistics.incoming, 1000)
    assert.equal(result.response.statistics.outgoing, 1)
    assert.equal(result.response.statistics.missed, 1)
    assert.equal(result.response.statistics.duration_seconds, 1075)
    assert.deepEqual(result.calls[1].range, [0, 999])
    assert.deepEqual(result.calls[2].range, [1000, 1999])
    const call = result.calls[0]
    assert.equal(call.table, 'call_logs')
    assert.equal(call.options.count, 'exact')
    assert.deepEqual(call.range, query === 'page=2' ? [50, 99] : [0, 49])
    assert.equal(call.orders[0][0], 'call_date')
    assert.equal(call.orders[0][1].ascending, false)
    assert.ok(call.columns.includes('assistant:sales_assistants(full_name)'))
    assert.ok(call.columns.includes('device:sales_assistant_devices(device_name, device_model)'))
  }
  for (const page of ['0', '-1', 'abc', '1.5', '1000001']) {
    const result = await run('GET', `page=${page}`)
    assert.equal(result.response.status, 400)
    assert.equal(result.calls.length, 0)
  }
  assert.equal((await run('GET', '', null, { role: 'owner' })).response.status, 200)
  const customSize = await run('GET', 'page=2&pageSize=200')
  assert.equal(customSize.response.pageSize, 200)
  assert.deepEqual(customSize.calls[0].range, [200, 399])
  for (const size of ['0', '-1', 'abc', '1.5', '5001']) {
    assert.equal((await run('GET', `pageSize=${size}`)).response.status, 400)
  }
  const filtered = await run('GET', 'callType=missed&phone=51234567')
  assert.equal(filtered.response.status, 200)
  assert.deepEqual(filtered.calls[0].filters, [['call_type', 'missed'], ['phone_number', '%51234567%']])
  assert.deepEqual(filtered.calls[1].filters, [['call_type', 'missed'], ['phone_number', '%51234567%']])
  const escaped = await run('GET', `phone=${encodeURIComponent('100%_')}`)
  assert.deepEqual(escaped.calls[0].filters, [['phone_number', '%100\\%\\_%']])
  assert.equal((await run('GET', 'callType=unknown')).response.status, 400)
  assert.equal((await run('GET', `phone=${'1'.repeat(41)}`)).response.status, 400)
  const empty = await run('GET', '', null, { empty: true })
  assert.equal(empty.response.statistics.incoming, 0)
  assert.equal(empty.response.statistics.duration_seconds, 0)
  assert.equal((await run('GET', '', null, { dbError: true })).response.status, 500)
  const callId = '11111111-1111-4111-8111-111111111111'
  assert.equal((await run('PATCH', '', { id: callId, follow_up_status: 'called' }, { anonymous: true })).response.status, 401)
  assert.equal((await run('PATCH', '', { id: 'nope', follow_up_status: 'called' })).response.status, 400)
  assert.equal((await run('PATCH', '', { id: callId, follow_up_status: 'nope' })).response.status, 400)
  assert.equal((await run('PATCH', '', { id: callId, follow_up_notes: 'x'.repeat(2001) })).response.status, 400)
  const saved = await run('PATCH', '', { id: callId, follow_up_status: 'called', follow_up_notes: ' ring later ' })
  assert.equal(saved.response.status, 200)
  assert.equal(saved.calls[0].operation, 'update')
  assert.deepEqual(JSON.parse(JSON.stringify(saved.calls[0].values)), { follow_up_status: 'called', follow_up_notes: 'ring later' })
  assert.deepEqual(saved.calls[0].filters, [['id', callId]])
  const opened = await run('PATCH', '', { id: callId, follow_up_status: '', follow_up_notes: '   ' })
  assert.deepEqual(JSON.parse(JSON.stringify(opened.calls[0].values)), { follow_up_status: null, follow_up_notes: null })
  assert.equal((await run('PATCH', '', { id: callId, follow_up_status: 'called' }, { notFound: true })).response.status, 404)
  const follow = await run('GET', 'followUp=call_later')
  assert.deepEqual(follow.calls[0].filters, [['follow_up_status', 'call_later']])
  const openFollowUp = await run('GET', 'followUp=open')
  assert.deepEqual(openFollowUp.calls[0].filters, [['follow_up_status', null]])
  assert.equal((await run('GET', 'followUp=nope')).response.status, 400)
  const noStats = await run('GET', 'stats=0')
  assert.equal(noStats.response.status, 200)
  assert.equal(noStats.calls.length, 1)
  assert.equal(noStats.response.statistics.incoming, 0)
  assert.equal(noStats.response.statistics.outgoing, 0)
  assert.equal(noStats.response.statistics.missed, 0)
  assert.equal(noStats.response.statistics.duration_seconds, 0)
  console.log('Call log API checks passed: authorization, pagination, related records, and error handling.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

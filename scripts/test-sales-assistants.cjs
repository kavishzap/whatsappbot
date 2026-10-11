const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const assistantId = '22222222-2222-2222-2222-222222222222'
const source = fs.readFileSync('src/app/api/sales-assistants/route.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

async function run(method, query, body, settings = {}) {
  const calls = []
  const db = {
    from(table) {
      const call = { table, filters: [], values: null, operation: 'select' }
      calls.push(call)
      const result = () => ({ data: settings.missing ? null : { id: assistantId }, error: null })
      const builder = {
        select() { return builder },
        eq(key, value) { call.filters.push([key, value]); return builder },
        order() { return Promise.resolve(result()) },
        maybeSingle() { return Promise.resolve(result()) },
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
  }
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: name => modules[name], console })
  const response = await exports[method]({ nextUrl: new URL(`https://example.test/api/sales-assistants?${query}`), json: async () => body })
  return { response, calls }
}

async function main() {
  const query = `id=${assistantId}`
  const body = { full_name: ' Alice ', email: ' ', phone_number: ' 123 ', is_active: true, company_id: 'other', id: 'other' }
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const anonymous = await run(method, query, body, { anonymous: true })
    assert.equal(anonymous.response.status, 401)
    assert.equal(anonymous.calls.length, 0)
    const member = await run(method, query, body, { role: 'member' })
    assert.equal(member.response.status, 403)
    assert.equal(member.calls.length, 0)
    const valid = await run(method, query, body)
    assert.equal(valid.response.status, method === 'POST' ? 201 : 200)
    const operation = valid.calls.find(call => call.table === 'sales_assistants')
    if (method === 'POST') {
      assert.equal(operation.values.company_id, undefined)
      assert.equal(operation.values.full_name, 'Alice')
      assert.equal(operation.values.email, null)
      assert.equal(operation.values.phone_number, '123')
      assert.equal(operation.values.id, undefined)
    } else {
      if (method !== 'GET') assert.deepEqual(operation.filters[0], ['id', assistantId])
      else assert.equal(operation.filters.length, 0)
    }
  }
  for (const method of ['PUT', 'DELETE']) {
    assert.equal((await run(method, query, body, { missing: true })).response.status, 404)
    assert.equal((await run(method, 'id=invalid', body)).response.status, 400)
  }
  for (const invalid of [{ ...body, full_name: ' ' }, { ...body, email: 'invalid' }, { ...body, is_active: 'true' }, { ...body, phone_number: 123 }]) {
    const result = await run('POST', query, invalid)
    assert.equal(result.response.status, 400)
    assert.equal(result.calls.filter(call => call.table === 'sales_assistants').length, 0)
  }
  console.log('Sales assistants API checks passed: authorization, generic CRUD, validation, and missing records.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

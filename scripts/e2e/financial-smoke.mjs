import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const accountName = 'Finch E2E Account A';

function localUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function preflight(env) {
  const keys = ['FINCH_E2E_WEB_URL', 'FINCH_E2E_API_URL', 'API_URL', 'FINCH_E2E_EMAIL_A',
    'FINCH_E2E_PASSWORD_A', 'FINCH_E2E_EMAIL_B', 'FINCH_E2E_PASSWORD_B'];
  if (keys.some((key) => !env[key]?.trim())) throw new Error('Preflight: required setting missing');
  const web = localUrl(env.FINCH_E2E_WEB_URL);
  const api = localUrl(env.FINCH_E2E_API_URL);
  const proxyTarget = localUrl(env.API_URL);
  if (!web || !api || !proxyTarget || web.origin === api.origin || proxyTarget.origin !== api.origin) {
    throw new Error('Preflight: distinct loopback Web/API origins and matching proxy target required');
  }
  const synthetic = (email) => /^finch-e2e-[a-z0-9][a-z0-9._+-]*@example\.test$/.test(email);
  if (!synthetic(env.FINCH_E2E_EMAIL_A) || !synthetic(env.FINCH_E2E_EMAIL_B) ||
      env.FINCH_E2E_EMAIL_A === env.FINCH_E2E_EMAIL_B ||
      env.FINCH_E2E_PASSWORD_A.length < 8 || env.FINCH_E2E_PASSWORD_B.length < 8) {
    throw new Error('Preflight: two distinct synthetic identities required');
  }
  return { web, api };
}

function cents(value) {
  const match = String(value).match(/^(-?\d+)(?:\.(\d{1,2}))?$/);
  assert.ok(match, 'API must return a decimal money value');
  return Number(match[1]) * 100 + (String(value).startsWith('-') ? -1 : 1) * Number((match[2] ?? '').padEnd(2, '0'));
}

function decimal(value) {
  return `${Math.trunc(value / 100)}.${String(Math.abs(value % 100)).padStart(2, '0')}`;
}

async function browser(session, command, ...args) {
  console.error(`E2E browser step: ${session.replace(/\d+/g, '#')} ${command}`);
  try {
    const { stdout } = await execFileAsync('npx', ['--yes', 'agent-browser@0.27.0', '--session', session,
      '--allowed-domains', 'localhost,127.0.0.1,::1', command, ...args], {
      timeout: 12_000, maxBuffer: 1024 * 1024,
      env: { ...process.env, AGENT_BROWSER_HEADED: 'false' },
    });
    return stdout.trim();
  } catch (error) {
    const detail = String(error?.stderr ?? error?.message ?? '').replace(/[\r\n]+/g, ' ').slice(0, 300);
    const target = command === 'click' ? ` target=${JSON.stringify(args[0])}` : '';
    throw new Error(`Browser step failed: ${command}${target}${detail ? ` (${detail})` : ''}`);
  }
}

async function evaluate(session, expression) {
  const output = await browser(session, 'eval', '-b', Buffer.from(expression).toString('base64'));
  try {
    return JSON.parse(output);
  } catch {
    throw new Error('Browser evaluation returned an unexpected shape');
  }
}

async function clickButton(session, label) {
  return evaluate(session, `(() => { const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === ${JSON.stringify(label)}); if (!button) throw new Error('button unavailable'); button.click(); return true; })()`);
}

async function request(session, path, options = {}) {
  assert.match(path, /^\/api\/[a-z_0-9/?=&-]+$/i);
  const expression = `(async () => { const res = await fetch(${JSON.stringify(path)}, ${JSON.stringify({
    credentials: 'include', cache: 'no-store', ...options,
  })}); const body = await res.json().catch(() => null); return JSON.stringify({status: res.status, body}); })()`;
  return JSON.parse(await evaluate(session, expression));
}

async function csrf(session) {
  const result = await request(session, '/api/csrf');
  assert.equal(result.status, 200, 'CSRF endpoint must be available');
  assert.ok(result.body?.csrf_token, 'CSRF endpoint must return token');
  return result.body.csrf_token;
}

async function findCreatedExpense(session, description, initialIds) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const transactions = await request(session, '/api/transactions?page=1&per_page=100');
    assert.equal(transactions.status, 200);
    const expense = transactions.body.transactions.find((item) => !initialIds.has(item.id) && item.description === description);
    if (expense) return expense;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('UI expense did not appear in the API transaction list');
}

async function login(session, origin, email, password) {
  await browser(session, 'open', `${origin}/login`);
  await browser(session, 'wait', '#login-email');
  await browser(session, 'fill', '#login-email', email);
  await browser(session, 'fill', '#login-password', password);
  await clickButton(session, 'Entrar');
  await browser(session, 'wait', '--text', 'Dashboard');
  const me = await request(session, '/api/me');
  assert.equal(me.status, 200, 'UI login must establish a session');
  assert.equal(me.body?.email, email, 'session identity must match UI login');
}

async function run(env) {
  const { web } = preflight(env);
  const suffix = `${Date.now()}-${process.pid}`;
  const a = `finch-e2e-a-${suffix}`;
  const b = `finch-e2e-b-${suffix}`;
  const description = `Finch E2E expense ${suffix}`;
  const friendlyTitle = 'feira de Casa';
  try {
    await browser(a, 'open', `${web.origin}/login`);
    const beforeLogin = await csrf(a);
    await login(a, web.origin, env.FINCH_E2E_EMAIL_A, env.FINCH_E2E_PASSWORD_A);
    const afterLogin = await csrf(a);
    assert.notEqual(afterLogin, beforeLogin, 'login must renew the CSRF token');

    const accounts = await request(a, '/api/accounts');
    assert.equal(accounts.status, 200);
    const account = accounts.body.find((item) => item.name === accountName && !item.archived_at);
    assert.ok(account, 'synthetic account fixture missing');
    const opening = cents(account.current_balance);
    assert.ok(opening >= 1000, 'synthetic account needs positive balance');

    // Invalid payload cannot create a transaction even if CSRF protection regresses.
    const missingToken = await request(a, '/api/transactions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction: {} }),
    });
    assert.equal(missingToken.status, 403, 'missing CSRF token must be rejected');
    assert.equal(missingToken.body?.error, 'Token CSRF inválido ou ausente',
      'CSRF rejection must happen before transaction validation');

    const beforeCreate = await request(a, '/api/transactions?page=1&per_page=100');
    assert.equal(beforeCreate.status, 200);
    const initialIds = new Set(beforeCreate.body.transactions.map((item) => item.id));

    await browser(a, 'open', `${web.origin}/transactions`);
    await browser(a, 'wait', '--text', 'Nova Transação');
    await clickButton(a, 'Nova Transação');
    await browser(a, 'wait', 'input[placeholder="Ex: Compra no supermercado"]');
    await browser(a, 'fill', 'input[placeholder="Ex: Compra no supermercado"]', description);
    await browser(a, 'fill', 'input[placeholder="Ex: Presente da Maria"]', friendlyTitle);
    const expenseAmount = opening - 100;
    await browser(a, 'fill', 'input[placeholder="0,00"]', decimal(expenseAmount).replace('.', ','));
    assert.equal(await evaluate(a, 'document.querySelector("input[placeholder^=Ex]")?.value'), description,
      'UI description field must contain the synthetic marker before saving');
    assert.equal(await evaluate(a, 'document.querySelector("input[placeholder*=Presente]")?.value'), friendlyTitle,
      'UI friendly title must contain the mixed-case input before saving');
    await clickButton(a, 'Salvar despesa');
    const expense = await findCreatedExpense(a, description.toUpperCase(), initialIds);
    assert.equal(expense.friendly_title, 'FEIRA DE CASA', 'API must persist an uppercase friendly title');
    await browser(a, 'reload');
    await browser(a, 'wait', '--text', 'FEIRA DE CASA');
    assert.ok(!expense.paid, 'UI must create an open loose expense');
    assert.equal(expense.source, 'cash');
    assert.equal(cents(expense.value), expenseAmount, 'UI expense must fit within the opening balance');

    const now = await evaluate(a, '(() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); })()');
    const [year, month] = now.split('-').map(Number);
    await browser(a, 'open', `${web.origin}/payments`);
    await browser(a, 'wait', '--text', 'Avulsas');
    await clickButton(a, 'Avulsas');
    await browser(a, 'wait', '--text', expense.friendly_title);
    await evaluate(a, `(() => { const card = [...document.querySelectorAll('div.rounded-xl')].find((item) => item.textContent.includes(${JSON.stringify(expense.friendly_title)}) && [...item.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Pagar despesa')); const button = [...(card?.querySelectorAll('button') ?? [])].find((item) => item.textContent.trim() === 'Pagar despesa'); if (!button) throw new Error('payment button unavailable'); button.click(); return true; })()`);
    await browser(a, 'wait', '#loose-settled-value');
    await browser(a, 'select', 'div.fixed select', String(account.id));
    await browser(a, 'click', 'div.fixed input[type="checkbox"]');
    assert.equal(await evaluate(a, 'document.querySelector("div.fixed input[type=checkbox]")?.checked'), true,
      'UI must explicitly confirm full settlement');
    await browser(a, 'fill', '#loose-settled-value', decimal(opening + 1));
    await clickButton(a, 'Confirmar pagamento da despesa');
    await browser(a, 'wait', '[role="alert"]');
    assert.match(await evaluate(a, 'document.querySelector("div.fixed [role=alert]")?.textContent ?? ""'), /Saldo insuficiente/);
    const failed = await request(a, `/api/payments?month=${month}&year=${year}`);
    assert.equal(failed.status, 200);
    const stillOpen = failed.body.loose_expenses.transactions.find((item) => item.id === expense.id);
    assert.ok(stillOpen && (stillOpen.payments?.length ?? 0) === 0, 'overdraw must not create settlement');
    assert.equal(stillOpen.paid, false, 'overdraw must leave the expense open');
    assert.equal(cents(stillOpen.remaining_amount), expenseAmount, 'overdraw must leave the full amount due');
    assert.equal(cents((await request(a, `/api/accounts/${account.id}`)).body.current_balance), opening);

    await browser(a, 'fill', '#loose-settled-value', decimal(expenseAmount));
    await clickButton(a, 'Confirmar pagamento da despesa');
    await browser(a, 'wait', '--text', `Despesa "${expense.friendly_title}" quitada.`);
    const paid = await request(a, `/api/payments?month=${month}&year=${year}`);
    assert.equal(paid.status, 200);
    assert.ok(!paid.body.loose_expenses.transactions.some((item) => item.id === expense.id),
      'settled expense must leave the open payments list');
    const afterPayment = await request(a, '/api/transactions?page=1&per_page=100');
    assert.equal(afterPayment.status, 200);
    const updated = afterPayment.body.transactions.find((item) => item.id === expense.id);
    assert.ok(updated, 'settled expense must remain in the transaction list');
    assert.equal(updated.paid, true, 'full settlement must mark the expense paid');
    assert.equal(updated.payment_status, 'paid');
    assert.equal(cents(updated.remaining_amount), 0, 'full settlement must leave no amount due');
    assert.equal(cents(updated.payments_total), expenseAmount);
    assert.equal(updated.payments?.length, 1, 'valid payment must create one settlement');
    assert.equal(cents(updated.payments[0].amount), expenseAmount);
    assert.equal(cents((await request(a, `/api/accounts/${account.id}`)).body.current_balance), opening - expenseAmount);

    await login(b, web.origin, env.FINCH_E2E_EMAIL_B, env.FINCH_E2E_PASSWORD_B);
    assert.equal((await request(b, `/api/accounts/${account.id}`)).status, 404, 'B cannot read A account');
    const bTransactions = await request(b, '/api/transactions?page=1&per_page=100');
    assert.ok(!bTransactions.body.transactions.some((item) => item.id === expense.id), 'B cannot list A expense');
    const bToken = await csrf(b);
    const denied = await request(b, `/api/payments/loose_expenses/${expense.id}/pay`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': bToken },
      body: JSON.stringify({ month, year, account_id: account.id, settled_on: now, amount: 1, settle: false }),
    });
    assert.equal(denied.status, 404, 'B cannot pay A expense');
    const afterDenied = await request(a, '/api/transactions?page=1&per_page=100');
    const unchanged = afterDenied.body.transactions.find((item) => item.id === expense.id);
    assert.equal(unchanged?.payments?.length, 1, 'B denial must not change A settlement');
    console.log('Financial smoke passed: UI login, CSRF, expense, balance, and A/B ownership.');
  } finally {
    await Promise.allSettled([browser(a, 'close'), browser(b, 'close')]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    preflight(process.env);
    if (process.argv.includes('--preflight')) console.log('Financial smoke preflight passed.');
    else await run(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Financial smoke failed');
    process.exitCode = 1;
  }
}

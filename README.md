# Finch Web

Interface Next.js do Finch. Use Yarn e o `yarn.lock` versionado para
instalar as dependências.

## Toolchain canônica

- Node `22.23.1` para o ambiente local, declarado em `.nvmrc`.
- Node `>=22.13.0 <23` como requisito compatível das dependências resolvidas.
- Yarn Classic `1.22.22`, declarado em `packageManager` e fornecido por Corepack.

Vitest 4 usa Vite 8/Rolldown; esse conjunto importa `styleText` de `node:util`.
Node 16 não exporta essa API e não é suportado. Não reduza Vitest nem atualize
dependências para contornar uma versão incorreta do runtime.

## Precheck e comandos

Com nvm instalado, execute sempre no diretório deste repositório antes de Yarn:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use
node -v
yarn -v
```

O resultado esperado é Node `v22.23.1` e Yarn `1.22.22`. Em seguida:

```bash
yarn install --frozen-lockfile
yarn test --run
yarn lint
yarn build
```

Para um teste focal, passe seu caminho ao Vitest:

```bash
yarn test src/lib/cardBrand.test.ts
```

## Desenvolvimento

Inicie o servidor local com:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Smoke financeiro E2E

O smoke usa duas identidades sintéticas, um banco PostgreSQL local descartável e
dois servidores HTTP em loopback. Confirme o alvo com os guardas da API antes de
preparar a fixture. No repositório da API, use Ruby `3.2.6`, `RAILS_ENV=development`,
`FINCH_E2E_DEVEL_DB=1`, `DATABASE_URL_DEVEL` apontando exclusivamente para o
alvo local aprovado pela API e as variáveis `FINCH_E2E_EMAIL_A/B` e
`FINCH_E2E_PASSWORD_A/B`. As identidades devem seguir o padrão
`finch-e2e-…@example.test`; nunca reutilize credenciais ou dados reais.
O launcher exige também um operador local existente. Prepare e, após o teste,
limpe a fixture com `script/e2e/prepare_development_fixture` e
`script/e2e/prepare_development_fixture cleanup` no repositório da API.

Depois de exportar as variáveis sintéticas acima, rode no terminal da API:

```bash
./script/e2e/prepare_development_fixture
FINCH_E2E_API_PORT=3101 ./script/e2e/server_development
```

Em outro terminal, inicie o Web isolado do cache de qualquer servidor Next já
aberto no checkout:

```bash
FINCH_E2E_NEXT_DIST_DIR=.next-e2e API_URL=http://127.0.0.1:3101 \
  yarn dev --hostname 127.0.0.1 --port 3100
```

Com a API e o Web em portas loopback distintas, configure `FINCH_E2E_API_URL`,
`FINCH_E2E_WEB_URL` e `API_URL` (proxy Web apontando para a mesma API), além
das mesmas identidades sintéticas. Em um terceiro terminal, no Web e após o
precheck de Node e Yarn acima:

```bash
export FINCH_E2E_API_URL=http://127.0.0.1:3101
export FINCH_E2E_WEB_URL=http://127.0.0.1:3100
export API_URL=http://127.0.0.1:3101
yarn test:e2e:preflight
yarn test:e2e:financial --preflight
yarn test:e2e:financial
```

O script recusa URLs fora do loopback, proxy divergente e identidades fora do
padrão. Ele cria uma despesa avulsa e uma compra de R$ 0,50 no cartão da fixture,
registra um pagamento parcial de R$ 0,25 na fatura e verifica saldo e isolamento
entre usuários. A execução altera somente a fixture preparada; a limpeza
também é protegida pelos guardas da API. Pare os dois servidores e execute o
`cleanup` da API mesmo se o smoke falhar.

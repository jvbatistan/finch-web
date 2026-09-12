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

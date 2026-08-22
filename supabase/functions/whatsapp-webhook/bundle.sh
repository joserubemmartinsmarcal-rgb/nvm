#!/bin/sh
# Gera `index.bundled.ts`: a função inteira em um arquivo só, para colar no
# editor de Edge Functions do painel do Supabase (que não tem import map).
#
# Uso: sh bundle.sh
#
# Não edite `index.bundled.ts` à mão — mexa em `parser.ts` / `index.ts` e rode
# este script de novo.

set -e

cd "$(dirname "$0")"

{
  printf '// ARQUIVO GERADO por bundle.sh — nao edite a mao.\n'
  printf '// Edite parser.ts / index.ts e rode: sh bundle.sh\n'
  printf '//\n'
  printf '// Versao de arquivo unico da funcao, para colar no editor do painel\n'
  printf '// do Supabase. O comportamento e identico ao dos arquivos separados.\n\n'

  printf "import { createClient } from 'npm:@supabase/supabase-js@2';\n\n"

  sed '/^import /d' parser.ts

  printf '\n'

  # Remove os imports: o createClient já foi declarado acima e o parser está inline.
  sed -e "/^import { createClient }/d" -e "/^import { buildChamado/d" index.ts
} > index.bundled.ts

printf 'index.bundled.ts gerado (%s linhas)\n' "$(wc -l < index.bundled.ts | tr -d ' ')"

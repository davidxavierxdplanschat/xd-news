# Panorama — Notícias em português

Leitor editorial independente para portfólio, com integração à API Top Stories do New York Times e tradução sob demanda de títulos e resumos para português brasileiro pelo DeepL. Sem conta, banco de dados ou coleta de dados pessoais. A aplicação não disponibiliza o texto integral das reportagens.

## Executar

Requisitos: Node.js 22 ou superior e npm. As versões efetivamente instaladas estão fixadas no `package-lock.json`.

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:3000. Sem chaves, o modo `auto` abre uma demonstração com 12 histórias fictícias, ilustrações SVG próprias e traduções preparadas. Não há chamadas externas para notícias ou tradução nesse modo. O aviso de demonstração permanece visível. A edição ilustrativa é datada de 13/10/2026 e não representa notícias atuais.

```sh
npm test
npm run typecheck
npm run build
npm start
```

Os scripts usam Webpack, suportado pelo Next.js, para evitar um problema observado no processo filho do Turbopack no Windows deste ambiente.

## Ativar notícias reais e tradução

Copie `.env.example` para `.env.local`, que é ignorado pelo Git. Nunca use o prefixo `NEXT_PUBLIC_` para chaves. Não cole credenciais em arquivos de código ou mensagens públicas.

1. Acesse https://developer.nytimes.com/, crie uma aplicação e habilite **Top Stories API**. Copie a chave para `NYT_API_KEY`.
2. Obtenha uma chave em uma conta **DeepL API**, distinta de uma assinatura do tradutor web. Configure `DEEPL_API_KEY` e `DEEPL_PLAN=free` ou `pro`, conforme a conta.
3. Defina `NEWS_MODE=live` e reinicie a aplicação. `auto` também utiliza notícias reais quando a chave do NYT está preenchida. `demo` força a demonstração mesmo com chaves presentes.

```dotenv
NEWS_MODE=live
NYT_API_KEY=sua-chave-do-nyt
DEEPL_API_KEY=sua-chave-da-api-deepl
DEEPL_PLAN=free
```

Esses valores são exemplos de configuração, não credenciais reais. Falhas de autenticação, rede ou limite em modo real mostram uma mensagem; não há troca silenciosa por conteúdo fictício. Sem chave do DeepL, as notícias continuam disponíveis e a tradução fica desabilitada com aviso.

O DeepL foi escolhido por oferecer uma API dedicada a tradução com destino `PT-BR`, preservando separadamente o título e o resumo. Não há geração de novos fatos, resumo adicional ou processamento do artigo completo. A tradução automática pode conter imprecisões; o original permanece disponível para comparação. Resultados de demonstração são identificados como exemplos, sem alegar uso de API.

## Experiência

- Destaques, Mundo, Economia, Tecnologia, Ciência, Cultura, Saúde, Esportes, Gastronomia e Viagem.
- Busca local nos títulos e resumos originais da categoria carregada. Não é uma pesquisa em todo o acervo do NYT, nem nos textos traduzidos.
- Uma notícia em destaque, grade editorial e layout adaptado para celular, tablet e desktop.
- Tradução individual, alternância com o original, estados de progresso e nova tentativa em caso de erro.
- Favoritos com uma cópia do conteúdo original, persistentes neste navegador mesmo ao trocar de categoria.
- Tema claro/escuro e categoria preferida no localStorage. Limite de 100 favoritos; adicionar além disso remove o mais antigo.
- Falhas no armazenamento mantêm dados em memória e mostram um aviso. Não há sincronização entre dispositivos.
- HTML semântico, foco visível, botão de pular para conteúdo, status acessíveis, redução de animação e diálogo com fechamento por Escape.
- Imagens ausentes ou que não carregam são substituídas por uma composição editorial. Créditos recebidos da API são preservados.

Favoritos são cópias locais e podem ficar desatualizados. Tradução de uma notícia real salva exige que ela continue na seleção atual da categoria em que foi salva. Se ela sair da API Top Stories, o leitor mantém o original e oferece o link da fonte, mas o servidor recusa uma nova tradução de conteúdo não reconhecido. Conteúdo do jornal pode estar sujeito a assinatura.

## Arquitetura

Next.js App Router com React e TypeScript. Tailwind CSS 4 é carregado via PostCSS; o sistema visual está em `globals.css` com variáveis de cor, tipografia e regras responsivas. As fontes são locais do sistema, sem dependência de serviços externos.

```text
src/
  app/
    api/news/route.ts       GET: valida categoria, busca e normaliza notícias
    api/translate/route.ts  POST: aceita apenas id e categoria
    globals.css            sistema visual e responsividade
    layout.tsx             idioma, metadados e ícone
    page.tsx               página principal
    error.tsx              recuperação de erro de renderização
  components/
    panorama.tsx           navegação, busca, favoritos, tema e diálogo
    article-card.tsx       notícia, imagem, tradução e link da fonte
  lib/
    types.ts               contrato de dados e categorias
    normalize.ts           dados ausentes, URLs seguras e deduplicação
    cache.ts               cache limitado, expiração e agrupamento de chamadas
    storage.ts             validação e persistência local
    demo.ts                histórias e traduções fictícias
    errors.ts              mensagens públicas de erro
    server/
      config.ts            modo e variáveis de ambiente
      news.ts              integração NYT e cache de notícias
      deepl.ts             adaptador substituível de tradução
      translate.ts         reconhecimento, cache e orçamento de tradução
      limits.ts            limites por janela e instância
      http.ts              validação HTTP, tamanho e erros
public/
  images/                  sete ilustrações vetoriais próprias
  icon.svg
tests/
  core.test.ts             testes dos fluxos críticos
```

Os módulos do servidor importam `server-only`, impedindo sua importação acidental por componentes de navegador. A chave do NYT é enviada somente ao host oficial no servidor. A chave do DeepL vai somente no cabeçalho de autenticação. Respostas e erros públicos não incluem chaves nem detalhes de requisições externas. Nenhuma entrada do usuário controla um host externo.

## API, limites e cache

`GET /api/news?section=home` devolve notícias normalizadas, modo, data de obtenção, disponibilidade de tradução e copyright. Só as categorias da lista permitida são aceitas. Conteúdo sem título ou URL HTTPS do NYT é descartado; imagens aceitas vêm de `static01.nyt.com`.

`POST /api/translate` aceita exatamente `{ "id": "id-da-noticia", "section": "home" }`. Não aceita texto, URL ou idioma arbitrários. O servidor consulta a seleção reconhecida e envia ao DeepL somente seu título e resumo. Corpo de requisição limitado a 1 KiB, inclusive para envio em partes; texto traduzível limitado a 4.000 caracteres. Origens cruzadas explícitas são rejeitadas. Essa verificação não substitui limites de uso ou autenticação.

Padrões configuráveis:

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `NEWS_CACHE_SECONDS` | 300 | Cache de notícias por categoria |
| `TRANSLATION_CACHE_SECONDS` | 86400 | Cache de tradução por conteúdo, idioma e provedor |
| `NYT_MIN_INTERVAL_MS` | 12000 | Intervalo global entre chamadas externas do NYT |
| `NYT_DAILY_LIMIT` | 500 | Máximo de chamadas NYT em uma janela de 24 horas |
| `TRANSLATION_REQUESTS_PER_MINUTE` | 12 | Chamadas externas de tradução por minuto |
| `TRANSLATION_CHARACTERS_PER_DAY` | 10000 | Orçamento de caracteres enviados em 24 horas |

Além disso, há um limite HTTP global por instância de 120 leituras e 60 solicitações de tradução por minuto. Não se confia em cabeçalhos de IP encaminhados pelo cliente; o controle é global. Em hospedagem pública, configure também limitação por visitante no provedor usando cabeçalhos confiáveis da plataforma.

Chamadas simultâneas para a mesma notícia ou tradução compartilham a mesma promessa. Falhas não são armazenadas. Alterações do texto original mudam a chave da tradução. O cache de notícias guarda até 20 seleções, e o de tradução até 500 resultados. O navegador reutiliza seleções por um minuto; atualizar solicita novamente ao servidor, preservando o cache do servidor.

Timeout: 10 segundos para NYT e 12 segundos para DeepL. Não há tentativas automáticas infinitas; o usuário pode tentar novamente. Respostas 429 incluem `Retry-After` e a interface de notícias respeita a espera. Cota esgotada no DeepL (456) é tratada como indisponibilidade de tradução.

**Limite da arquitetura sem banco:** caches e contadores vivem em memória do processo e são reiniciados com o servidor. Na Vercel ou em múltiplas instâncias, cada processo tem seu próprio cache e orçamento. Assim, não há deduplicação distribuída nem garantia de teto global de custos. Para tráfego público maior, substitua os caches/contadores por armazenamento compartilhado e aplique limites no provedor. Configure também um teto de gastos na conta DeepL.

O DeepL API Free e Pro possuem cotas e cobrança distintas; traduções consomem caracteres do título e resumo. Confira o preço e os limites vigentes na conta do provedor. O projeto não presume tradução ilimitada ou gratuita. O orçamento local padrão de 10.000 caracteres limita uma instância, não toda a conta.

## Publicação

O projeto foi preparado para hospedagem com suporte a Next.js e rotas Node.js, como a Vercel. Não funciona como exportação puramente estática, pois as chaves e integrações precisam de servidor.

1. Envie a pasta do projeto a um repositório, incluindo `package-lock.json` e excluindo `.env.local`, `.next` e `node_modules`.
2. Importe o repositório na Vercel e selecione o preset Next.js.
3. Configure as variáveis em Settings → Environment Variables. Para uma demonstração pública, use `NEWS_MODE=demo` sem chaves.
4. Use `npm ci` como instalação e `npm run build` como build. Depois de configurar variáveis, faça um novo deploy.
5. Para notícias reais, configure NYT e DeepL no servidor e valide os limites e condições vigentes das contas.

Nenhum deploy público foi realizado nesta entrega local. Não é necessário contratar serviços para explorar a demonstração.

## Atribuição e fontes consultadas

Em modo real, cada notícia mantém autoria, crédito da imagem e link para a fonte. O rodapé mostra The New York Times e o copyright recebido. A identidade Panorama e o aviso de independência evitam sugerir uma aplicação oficial. O modo demonstrativo não atribui histórias fictícias ao NYT.

- Especificação oficial Top Stories: https://github.com/nytimes/public_api_specs/blob/master/top_stories/top_stories_v2.json
- Portal e documentação atual: https://developer.nytimes.com/
- Atribuição: https://developer.nytimes.com/attribution
- Termos da API: https://developer.nytimes.com/tou
- Tradução DeepL: https://developers.deepl.com/api-reference/translate/request-translation
- Autenticação DeepL: https://developers.deepl.com/docs/getting-started/auth
- Idiomas: https://developers.deepl.com/docs/getting-started/supported-languages
- Next.js: https://nextjs.org/docs/app/getting-started/installation
- Tailwind: https://tailwindcss.com/docs/installation/framework-guides/nextjs

A especificação oficial no GitHub foi acessível. As páginas do portal NYT de atribuição e FAQ não puderam ser abertas pela ferramenta de pesquisa nesta sessão; os limites atuais da sua conta e eventual uso obrigatório do selo oficial precisam ser conferidos no portal ao ativar a aplicação. Os valores locais acima são limites conservadores do projeto, não uma afirmação sobre sua cota NYT ou aprovação de uso.

## Verificação

Os testes automatizados cobrem normalização, imagens seguras, deduplicação, cache simultâneo e expiração, erros externos, notícia desconhecida, tradução para PT-BR, invalidação por conteúdo, rejeição de texto arbitrário, origem cruzada, corpo excessivo, favoritos e preferências corrompidas, e controles de abuso.

As chamadas externas são simuladas nos testes. Esta entrega não inclui credenciais NYT ou DeepL, portanto a autenticação real e a qualidade de uma tradução faturada não foram verificadas. Consulte `VALIDACAO.md` para os resultados executados.

## Texto para portfólio

**Panorama — Notícias em português:** aplicação web editorial desenvolvida com Next.js, React, TypeScript e Tailwind CSS. Integra a API Top Stories do New York Times e tradução sob demanda para português brasileiro pelo DeepL, com credenciais protegidas no servidor, cache, controle de uso, favoritos locais, tema escuro e interface responsiva. Inclui modo demonstrativo independente e testes dos fluxos críticos de integração e segurança.

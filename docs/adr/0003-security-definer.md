# ADR 0003 — As funções `security definer` da Fase 1

- Estado: aceite
- Data: 2026-08-29
- Cumpre: F1-7 de `docs/plano/fase-0-1.md`
- Verificado por: `scripts/check-security-definer.mjs`, no CI

## Por que este documento existe

Uma função `security definer` corre com os privilégios de quem a criou, não de
quem a chama. Dentro deste esquema, isso significa **ignorar a RLS** — a única
coisa que faz cumprir as regras 1 a 3 do produto. Cada uma destas funções é, por
construção, um buraco autorizado.

Um buraco autorizado sem justificação escrita transforma-se, em seis meses, num
buraco. Daí a regra: nenhuma função `security definer` sem uma entrada aqui, e
um script no CI que compara a lista real em `pg_proc` com este ficheiro.

Todas têm `set search_path = ''`, sem excepção. Uma `security definer` com o
caminho de pesquisa por omissão é sequestrável por quem consiga criar um objecto
num esquema mais à frente no caminho — é o vector clássico de escalada de
privilégios em Postgres, e o teste 000 falha se alguma o perder.

## As funções

### `blocked(other uuid) → boolean`

Existe bloqueio, em qualquer direcção, entre quem pergunta e `other`.

**Por que não pode ser `invoker`.** A política de `blocks` só mostra as linhas
em que se é o bloqueador — de propósito: quem é bloqueado não deve saber que o
é. Como `invoker`, esta função nunca veria o lado em que sou o bloqueado, e o
bloqueio deixaria de ser simétrico. Toda a gente bloqueada continuaria a ver as
notas de quem a bloqueou.

**Se for mal usada.** É um oráculo de «estou bloqueado por X?». Quem chame
`select blocked('<uuid>')` sabe que há bloqueio, informação que a política de
`blocks` esconde. Custo aceite: a mesma resposta obtém-se em duas chamadas —
o perfil desaparecer da vista já diz o mesmo. A alternativa seria não a expor a
`authenticated`, mas as políticas RLS são avaliadas com os privilégios de quem
consulta e precisam de a poder executar.

### `visible_profile(other uuid) → boolean`

Posso ver este perfil: sou eu, ou é público, ou sigo-o com pedido aceite. E não
há bloqueio.

**Por que não pode ser `invoker`.** Lê `profiles.is_private`, e a política de
`profiles` chama esta função. Como `invoker`, seria recursão infinita — o
Postgres aborta com «infinite recursion detected in policy».

**Se for mal usada.** Responde sobre a relação de quem chama com `other`, nunca
sobre terceiros. Não há entrada que a faça responder por outra pessoa.

### `in_my_circle(other uuid) → boolean`

`other` está no Círculo de quem pergunta.

**Por que não pode ser `invoker`.** Contém `blocked()`, que é `definer` pela
razão acima; e chamá-la dentro da política de `circle_members` recursaria.

**Se for mal usada.** Como acima: só responde sobre o Círculo do próprio.

### `tenho_balde(t subject_type, s uuid) → boolean`

O predicado da nota cega: «eu avaliei este título?».

**Por que não pode ser `invoker`.** A política de leitura de `buckets` precisa
de consultar `buckets`. Uma subconsulta sobre a mesma tabela reentra na política
e o Postgres aborta por recursão. A mesma subconsulta dentro da política de
`rank_positions` recairia na política de `buckets` e recursaria na mesma. Este
bug foi encontrado pelo teste `010-nota-cega.sql`, não por leitura do SQL.

**Se for mal usada.** Filtra sempre por `auth.uid()` e devolve um booleano sobre
o próprio. Não existe argumento que a faça responder sobre outra pessoa.

### `handle_new_user()` — trigger em `auth.users`

Cria a linha em `public.profiles` quando nasce uma conta.

**Por que não pode ser `invoker`.** O trigger corre no contexto do registo, onde
quem escreve não tem privilégios em `public.profiles`. Sem esta função existiria
uma janela entre o registo e a criação do perfil em que `auth.uid()` não
corresponde a nenhuma linha de `profiles` — e todas as políticas que consultam
`profiles` falhariam em silêncio nessa janela.

**Se for mal usada.** Só corre a partir de um `insert` em `auth.users`, que só o
Auth faz. O `handle` vem de `raw_user_meta_data` e é validado pelo `CHECK` da
coluna; um handle já em uso faz falhar o registo inteiro, que é o comportamento
correcto.

### `follows_forcar_estado()` — trigger em `follows`

Decide se um `follow` nasce `pending` ou `active`, a partir da privacidade do
alvo.

**Por que não pode ser `invoker`.** Este é o caso mais importante do documento.
Como `invoker`, a leitura de `profiles.is_private` está sujeita à política de
`profiles` — e quem pede para seguir um perfil privado, por definição, ainda não
o vê. A variável vinha `NULL`, o `case` caía no ramo `else`, e **qualquer
estranho conseguia seguir um perfil privado directamente em `active`**. A regra
2 caía inteira, sem erro nenhum. O caso 7 do teste `020` é este bug.

**Se for mal usada.** Só corre em `before insert`. Ignora o `state` que o
cliente enviar, que é o ponto.

### `circulo_reciproco()` — trigger em `circle_members`

Exige `follows` activo nos dois sentidos e ausência de bloqueio.

**Por que não pode ser `invoker`.** Pela razão de `blocked()`: um bloqueio feito
na direcção contrária é invisível a quem insere, e formar-se-ia Círculo com quem
nos bloqueou.

**Se for mal usada.** Valida `NEW`, que a política de `circle_members` já obriga
a ter `owner_id = auth.uid()`.

### `bloqueio_demolir()` — trigger em `blocks`

Apaga `follows` e `circle_members` nos dois sentidos quando alguém bloqueia.

**Por que não pode ser `invoker`.** Tem de apagar linhas de outra pessoa: a
política de `circle_members` só permite apagar as do próprio dono, portanto como
`invoker` o bloqueio limpava um lado e deixava o outro intacto.

**Se for mal usada.** Só apaga linhas que envolvem o par (bloqueador,
bloqueado), e só a partir de um `insert` em `blocks` que a política já restringe
a `blocker_id = auth.uid()`.

### `purgar_retencao()`

Apaga denúncias com mais de 180 dias e auditoria com mais de 2 anos (ADR 0002).

**Por que não pode ser `invoker`.** Apaga linhas que nenhum utilizador consegue
sequer ler — `moderation_audit` não tem uma única política.

**Se for mal usada.** `execute` está revogado a `anon` e a `authenticated`: só
`service_role` a pode chamar. Apaga apenas o que já passou da data.

## O que ficou de fora

`renumerar_ambito`, `circulo_contar`, `follows_transicao`,
`profiles_proteger_contador` e `scope_global` são `security invoker`. Todas
operam sobre linhas que quem chama já pode escrever, e não precisam de ver
nada que lhes esteja vedado.

Não existe nenhuma função `security definer` para **ler notas**. Se aparecer uma
proposta dessas, o problema está na política, não na falta da função.

Também não existe `handle_available()`, prevista no desenho de F1-0: a vista
`profile_cards` já responde à mesma pergunta com uma coluna `handle` única, e um
segundo caminho para a mesma informação seria mais um `security definer` a
manter e mais um oráculo a defender.

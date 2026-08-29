# Fase 3 — Motor de ranking comparativo

Responsável: `ranking-engineer`. Fonte das caixas: `.claude/PLAN.md`.

**Aceitação: avaliar 30 títulos reais à mão sem irritação.** Se cansar, o
algoritmo muda antes de a fase fechar. É o único critério desta fase que não é
automatizável, e é o que decide se o produto existe — a regra 4 diz que a nota é
derivada de comparações, e se comparar for chato ninguém dá notas nenhumas.

**Zero dependências de React, de rede e de Supabase neste módulo.** Lógica pura,
em `src/ranking/`. É o que permite os testes de propriedades e o fuzz correrem
em milissegundos.

---

## As três decisões de produto

### D1 · As notas abrem-se devagar

Num balde com poucos títulos, as notas ficam comprimidas ao centro do intervalo
e vão abrindo à medida que o balde enche. Um balde considera-se cheio aos 5.

| títulos no balde | notas em «Adorei» (8.0–10.0) |
| ---------------- | ---------------------------- |
| 1                | 9.0                          |
| 2                | 9.3 · 8.8                    |
| 3                | 9.5 · 9.0 · 8.5              |
| 4                | 9.8 · 9.3 · 8.8 · 8.3        |
| 5 ou mais        | 10.0 · 9.5 · 9.0 · 8.5 · 8.0 |

A amplitude é `(n-1)/(5-1)`, limitada a 1. Com um título só, amplitude zero: fica
no centro.

Porquê: a alternativa — espalhar sempre por todo o intervalo — faz o primeiro
«adorei» saltar de 9.0 para 10.0 assim que entra o segundo. Os saltos maiores
aconteceriam nos primeiros títulos, que é exactamente quando toda a gente está.
Uma nota que se move muito deixa de ser uma nota e passa a ser uma posição
disfarçada de número.

E dá significado ao 10.0: **um 10.0 quer dizer que ganhou a pelo menos quatro
títulos.** Não é um prémio de participação ao primeiro filme que se avalia.

Custo assumido: quem tem três «adorei» vê 9.5, 9.0 e 8.5 e pode achar que o
sistema lhe está a «esconder» o 10. É o preço de o 10 valer alguma coisa.

### D2 · O arrasto fica pregado para sempre

Reordenar à mão marca o título. Nenhuma comparação futura o move sozinho; só
outro arrasto o desprega.

Porquê: «soberana» lido à letra. Se uma comparação pudesse desfazer um arrasto,
a pessoa faria o mesmo arrasto duas vezes e concluiria — com razão — que a app
não a ouve.

Custo assumido, e é real: com o tempo o ranking enche-se de pontos fixos que
travam o algoritmo. Fica registado. Se na Fase 5 se vir que os rankings ficam
rígidos de mais, a saída é mostrar quais estão pregados e deixar despregar, não
é o algoritmo passar por cima.

Implementação: coluna `pinned` em `rank_positions`. Uma migração nova, não uma
alteração à da Fase 1 — a Fase 1 está fechada e com veredicto.

### D3 · Taste match precisa de 10 títulos em comum

Abaixo de 10, não se mostra nada. Nem a percentagem, nem o número.

Porquê: com 5 títulos em comum, um deles diferente move a percentagem em
dezenas de pontos. Mostrar um número que salta assim é pior do que não mostrar.

Consequência: a política RLS de `taste_match` passa de `overlap >= 5` para
`>= 10`. É uma migração, e é também uma superfície de fuga a menos.

---

## Tarefas

### F3-1 · Baldes e intervalos · `src/ranking/baldes.ts`

`nah` 0.0–4.9 · `gostei` 5.0–7.9 · `adorei` 8.0–10.0.

Critério: os intervalos não se sobrepõem e não deixam buracos entre si dentro da
sua própria escala; uma nota derivada cai sempre dentro do intervalo do seu
balde. Testado por propriedade, não por exemplos.

### F3-2 · Derivação da nota · `src/ranking/derivar.ts`

Implementa D1.

Critério: a tabela de D1 reproduzida em teste, valor a valor. E uma propriedade:
para qualquer balde e qualquer `n`, as notas são estritamente decrescentes com a
posição, e todas caem dentro do intervalo.

**A mesma derivação existe em SQL**, na vista `scores`, porque é de lá que o
cliente lê. Duas implementações da mesma regra divergem — por isso há um teste
que corre as duas com os mesmos dados e compara. Sem esse teste, esta é a
próxima defesa decorativa deste projecto.

### F3-3 · Inserção binária · `src/ranking/comparar.ts`

Máximo rígido de 5 comparações. Cinco comparações colocam com exactidão entre
até 31 títulos (`2^5 - 1`); acima disso, as 5 estreitam a janela e o título
entra no meio do que sobrar.

Critério: nunca mais de 5 perguntas, em nenhum caso. O primeiro título de um
balde não gera comparação nenhuma. «Não sei» aborta e insere no ponto médio da
janela corrente — não é uma resposta errada, é a ausência de resposta.

### F3-4 · Posições · `src/ranking/posicoes.ts`

Inteiros esparsos de passo 1024, com renumeração quando o intervalo se esgota.
É o espelho em TypeScript do que a Fase 1 fez em SQL.

Critério: um teste de fuzz com 1000 inserções nunca produz duas posições iguais
no mesmo âmbito nem uma ordem incoerente.

### F3-5 · Três âmbitos · `src/ranking/ambitos.ts`

Filmes, séries, e episódios por série. Independentes: um episódio nunca compara
com um filme.

Critério: o âmbito de um episódio é o `titles.id` da série. Comparar entre
âmbitos é impossível por tipos, não por disciplina.

### F3-6 · Reavaliação e mudança de balde

Critério: reavaliar reinicia o fluxo para esse título. Mudar de balde move-o
entre intervalos sem corromper as posições dos outros — o título sai de um
âmbito ordenado e entra noutro, e os dois ficam coerentes.

### F3-7 · Taste match · `src/ranking/tasteMatch.ts`

Critério: `null` abaixo de 10 títulos em comum (D3). Acima, uma medida de
concordância sobre os títulos avaliados por ambos.

### F3-8 · Migração

`rank_positions.pinned`, e `overlap >= 10` na política de `taste_match`.

Critério: o `db reset` continua a correr do zero; os 59 testes pgTAP e os 26
ataques continuam a passar. Uma migração da Fase 3 não pode reabrir a Fase 1.

### F3-9 · Testes de propriedades e fuzz

Critério: a ordem final é consistente com todas as comparações respondidas —
se respondi «A melhor que B», A fica acima de B, sempre. Fuzz com 1000
inserções: nunca mais de 5 comparações, ranking nunca corrompido.

### F3-10 · Aceitação à mão

Avaliar 30 títulos reais. Não é automatizável e é o critério que manda.

---

## O que esta fase não faz

- **Não desenha nada.** O ecrã de comparação é da Fase 5. Este módulo devolve
  «que par mostrar a seguir» e recebe «qual ganhou».
- **Não escreve na base.** Devolve as posições novas; quem as grava é a camada
  de dados, na Fase 5.
- **Não decide o que comparar com o quê além do balde.** Escolher pares por
  afinidade ou por popularidade é uma ideia para depois, e provavelmente má:
  torna o resultado dependente de uma heurística que ninguém consegue explicar.

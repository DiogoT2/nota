# F3-10 · Aceitação da Fase 3

## O que foi feito, e o que isso vale

O plano pedia 30 títulos avaliados à mão, «sem irritação». Foram avaliados 7 à
mão, numa corrida instrumentada, e a corrida foi interrompida por curiosidade
satisfeita e não por cansaço. O resto foi substituído por simulação, a pedido.

Isto tem de ficar escrito porque muda o que está provado: **nenhum script se
irrita.** A simulação não diz que a app é agradável de usar. Diz que o
algoritmo aguenta volume — que é a metade que uma pessoa nunca teria paciência
para testar, e que uma sessão à mão de 30 títulos também não testaria.

O que continua por provar é a fricção real com 30 títulos seguidos. Fica em
aberto para os primeiros utilizadores, e é a primeira coisa a medir na Fase 5,
onde o ecrã de comparação existe de facto.

## O instrumento

`npm run simular` corre o motor verdadeiro — `avaliar`, `responderA`, `notas`.
Só a pessoa é substituída: cada título tem uma qualidade oculta e o oráculo
responde comparando-as, com ruído proporcional à proximidade e com «não sei»
quando são indistinguíveis. Determinista: mesma semente, mesmo resultado.

A distribuição dos baldes é enviesada de propósito — 55% «adorei» — porque foi
isso que a corrida à mão mostrou. As pessoas avaliam o que gostaram. Simular
baldes equilibrados seria simular outra app.

## Resultados

200 sessões de 30 títulos, ruído 0.15:

```
comparações por título   média 1.91   mediana 2   p95 4   máximo 5
acima do tecto de 5      0
custo ao longo da sessão 1-6: 0.9   7-12: 1.7   13-18: 2.2   19-24: 2.3   25-30: 2.5
tau de Kendall           0.687   pior sessão 0.443
agitação                 27.1% das notas mudam por título novo, desvio médio 0.17
```

Escala, com 500 títulos: média 2.90 comparações, máximo 5, agitação 2.9%.

### 1. O tecto de 5 aguenta, e quase não custa nada

Nunca foi furado, em nenhuma configuração: 30, 100 ou 500 títulos.

A pergunta interessante não é essa, é quanto custa. Cinco comparações não
chegam para ordenar com exactidão um balde de 250 — precisariam de oito. Com um
avaliador perfeitamente coerente (`--ruido 0`), que isola o erro do algoritmo do
erro da pessoa:

| títulos | tau de Kendall |
| ------- | -------------- |
| 30      | 1.000          |
| 100     | 0.992          |
| 500     | 0.968          |

O tecto rígido custa 3% de fidelidade de ordem a 500 títulos. Isso é barato ao
ponto de não valer a pena discutir: a alternativa era uma sexta e uma sétima
pergunta por cada filme, para sempre.

**Os 0.687 do caso realista não são do algoritmo — são da pessoa.** Um avaliador
que se contradiz quando os títulos são próximos produz um ranking que se
contradiz. Nenhuma quantidade de perguntas resolve isso, e mais perguntas
pioravam-no: quanto mais perto se aperta a comparação, mais a resposta é uma
moeda ao ar.

### 2. As notas mexem-se sozinhas, e isso é permanente

A 30 títulos, **27% das notas já dadas mudam sempre que entra um título novo.**
Desvio médio 0.17, máximo 1.0.

Não é um defeito nem se corrige: é a regra 4 do produto a funcionar. A nota é
derivada da posição; quando um balde passa de n para n+1 títulos, todos os
lugares se redistribuem pelo intervalo. Congelar notas seria escrever notas, e
a regra diz que a nota nunca é escrita.

Duas coisas que a simulação mostrou e que não eram óbvias:

- **A agitação decai com a colecção**, de 27% aos 30 títulos para 2.9% aos 500.
  O período agitado é exactamente o princípio, que é quando toda a gente está e
  quando ninguém percebe ainda como a app funciona.
- **A maior parte da agitação é em baldes já cheios**, não na abertura das
  notas da decisão D1. Ou seja: não acaba aos 5 títulos, continua para sempre,
  só que cada vez mais pequena.

Consequência para a Fase 5, registada aqui para não se perder: o ecrã tem de
mostrar que a nota é relativa e não absoluta. Uma nota que muda sozinha sem
explicação é a queixa que ninguém consegue articular e toda a gente sente.

### 3. O balde «nah» é 2.5 vezes mais volátil que o «adorei»

Não foi escolhido por ninguém, sai da aritmética: `nah` tem 4.9 pontos de
intervalo e `adorei` tem 2.0. A mesma mudança de um lugar mexe 2.5 vezes mais
na nota. O pior desvio observado, 1.0, é sempre num balde `nah` pequeno.

Fica registado e não se mexe agora. Os intervalos vêm do PLAN.md e mudá-los é
uma decisão de produto, não uma optimização; e o balde `nah` é o menos usado,
portanto é onde menos gente vai reparar.

### 4. Renumerações

Raras a 30 títulos (7 em 200 sessões), quase uma por sessão a 100, 2.8 por
sessão a 500. É o comportamento desenhado na Fase 1 e o custo é uma escrita em
lote no âmbito. Nada a fazer.

## Veredicto

O motor fecha do lado mecânico. O tecto aguenta, a ordem é fiel, o custo por
título estabiliza perto das 3 comparações e não cresce com a colecção.

Fica por fechar o lado humano, e está dito acima em vez de escondido numa caixa
marcada.

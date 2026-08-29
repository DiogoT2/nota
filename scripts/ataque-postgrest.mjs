#!/usr/bin/env node
/**
 * F1-8 · A bateria de ataque, de fora, contra o PostgREST.
 *
 * Os testes pgTAP atacam de dentro da base. Esta bateria ataca pela porta por
 * onde a app entra, que é a que um telemóvel com o certificado desafixado
 * também usa. A diferença importa: o PostgREST acrescenta superfície que a RLS
 * sozinha não cobre — contagens, embeds, ordenações, upserts, agregações e
 * mensagens de erro que distinguem «não existe» de «não podes ver».
 *
 * Plano em `docs/ataque-fase-1.md`. Uma única falha bloqueia a Fase 1.
 *
 * `service_role` só aparece na preparação do terreno e para estabelecer a
 * verdade contra a qual se mede. Nunca para atacar: atacar com a chave que
 * ignora a RLS não testa nada.
 */
import { token } from './token.mjs';

const BASE = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const U = {
  ana: '11111111-1111-1111-1111-111111111111',
  bruno: '22222222-2222-2222-2222-222222222222',
  carla: '33333333-3333-3333-3333-333333333333',
  david: '44444444-4444-4444-4444-444444444444',
  eva: '55555555-5555-5555-5555-555555555555',
  fabio: '66666666-6666-6666-6666-666666666666',
};
const FILME = 'aaaa0001-0000-4000-8000-000000000001';
const EP = 'dddd0001-0000-4000-8000-000000000001';
const INEXISTENTE = 'eeee9999-0000-4000-8000-000000000999';

async function rest(
  caminho,
  { como = 'fabio', metodo = 'GET', corpo, prefer, jwt } = {},
) {
  const auth = jwt ?? (como === 'service' ? SERVICE : token(como));
  const cabecalhos = {
    apikey: ANON,
    Authorization: `Bearer ${auth}`,
    'Content-Type': 'application/json',
  };
  if (prefer) cabecalhos.Prefer = prefer;

  const r = await fetch(`${BASE}/rest/v1/${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  let json;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }
  return {
    estado: r.status,
    contentRange: r.headers.get('content-range'),
    corpo: json,
    texto,
  };
}

const resultados = [];
function registar(id, nome, passou, detalhe) {
  resultados.push({ id, nome, passou, detalhe });
}
async function ataque(id, nome, fn) {
  try {
    const { passou, detalhe } = await fn();
    registar(id, nome, passou, detalhe);
  } catch (erro) {
    registar(id, nome, false, `erro no próprio ataque: ${erro.message}`);
  }
}

const vazio = (r) => Array.isArray(r.corpo) && r.corpo.length === 0;

// ── Grupo 1 · Nota cega ──────────────────────────────────────────────────────

await ataque('A1', 'ler posições alheias sem ter avaliado', async () => {
  const r = await rest('rank_positions?select=*');
  return { passou: vazio(r), detalhe: `${r.estado} · ${r.texto.slice(0, 120)}` };
});

await ataque('A2', 'inferir quantos avaliaram, com Prefer: count=exact', async () => {
  const r = await rest(`rank_positions?select=*&subject_id=eq.${FILME}`, {
    metodo: 'HEAD',
    prefer: 'count=exact',
  });
  // O content-range vem como `*/0` quando não há linhas visíveis. Se viesse
  // `*/5`, a contagem estaria a ser feita antes do filtro de RLS e revelaria
  // quantas pessoas avaliaram o filme sem eu o ter avaliado.
  const conta = (r.contentRange ?? '').split('/')[1];
  return { passou: conta === '0', detalhe: `content-range: ${r.contentRange}` };
});

await ataque('A3', 'inferir por ordenação numa coluna não visível', async () => {
  const r = await rest('rank_positions?select=subject_id&order=position.desc&limit=5');
  return { passou: vazio(r), detalhe: `${r.estado} · ${r.texto.slice(0, 120)}` };
});

await ataque(
  'A4',
  'distinguir «não existe» de «não posso ver» pela resposta',
  async () => {
    const invisivel = await rest(`rank_positions?select=*&subject_id=eq.${FILME}`);
    const inexistente = await rest(
      `rank_positions?select=*&subject_id=eq.${INEXISTENTE}`,
    );
    const igual =
      invisivel.estado === inexistente.estado && invisivel.texto === inexistente.texto;
    return {
      passou: igual,
      detalhe: `invisível ${invisivel.estado} «${invisivel.texto}» · inexistente ${inexistente.estado} «${inexistente.texto}»`,
    };
  },
);

await ataque('A5', 'avaliar, ler, apagar a avaliação, voltar a ler', async () => {
  const criar = await rest('buckets', {
    metodo: 'POST',
    corpo: { user_id: U.fabio, subject_type: 'movie', subject_id: FILME, bucket: 'nah' },
    prefer: 'return=representation',
  });
  const durante = await rest(`rank_positions?select=user_id&subject_id=eq.${FILME}`);
  const viu = Array.isArray(durante.corpo) && durante.corpo.length > 0;

  await rest(`buckets?user_id=eq.${U.fabio}`, { metodo: 'DELETE' });
  const depois = await rest(`rank_positions?select=user_id&subject_id=eq.${FILME}`);

  return {
    passou: criar.estado === 201 && viu && vazio(depois),
    detalhe: `avaliou ${criar.estado}, viu ${durante.corpo?.length ?? '?'} linhas, depois de apagar ${depois.corpo?.length ?? '?'}`,
  };
});

// ── Grupo 2 · Visibilidade de perfil ─────────────────────────────────────────

await ataque('A6', 'ler perfil privado sendo estranho', async () => {
  const r = await rest('profiles?select=*&handle=eq.carla');
  return { passou: vazio(r), detalhe: r.texto.slice(0, 120) };
});

await ataque('A7', 'ler perfil privado com pedido em pending', async () => {
  const r = await rest('profiles?select=*&handle=eq.carla', { como: 'david' });
  return { passou: vazio(r), detalhe: r.texto.slice(0, 120) };
});

await ataque(
  'A8',
  'contornar por embed: profiles?select=*,rank_positions(*)',
  async () => {
    const r = await rest(
      'profiles?select=handle,rank_positions(subject_id,position),buckets(bucket)',
    );
    // Contar linhas embebidas, não procurar a palavra no JSON: a primeira versão
    // deste ataque procurava «position» no texto da resposta e dava positivo
    // contra a chave «rank_positions». Um ataque com falsos positivos gasta o
    // tempo de quem lê o relatório e ensina a duvidar dele.
    const embebidas = (r.corpo ?? []).flatMap((linha) => [
      ...(linha.rank_positions ?? []),
      ...(linha.buckets ?? []),
    ]);
    return {
      passou: embebidas.length === 0,
      detalhe: `${r.estado} · ${embebidas.length} linhas embebidas · ${r.texto.slice(0, 140)}`,
    };
  },
);

await ataque('A9', 'distinguir «perfil sem notas» de «perfil que não vejo»', async () => {
  // A carla é privada e invisível ao fabio; o bruno também. Ambos os perfis
  // existem e ambos têm notas. Se a resposta os distinguisse de um perfil sem
  // notas, a forma do resultado seria o oráculo.
  const a = await rest('profiles?select=handle&handle=eq.carla');
  const b = await rest('profiles?select=handle&handle=eq.bruno');
  return {
    passou: a.texto === b.texto && vazio(a),
    detalhe: `carla «${a.texto}» · bruno «${b.texto}»`,
  };
});

// ── Grupo 3 · Círculo e episódios ────────────────────────────────────────────

await ataque('A10', 'ler notas de episódio fora do Círculo', async () => {
  // O david segue a ana (pública), avaliou o mesmo episódio, mas não é Círculo.
  const r = await rest(
    `rank_positions?select=*&subject_type=eq.episode&user_id=eq.${U.ana}`,
    { como: 'david' },
  );
  return { passou: vazio(r), detalhe: r.texto.slice(0, 140) };
});

await ataque('A11', 'ler nota de episódio de um episódio não visto', async () => {
  await rest(`watched?user_id=eq.${U.ana}&episode_id=eq.${EP}`, {
    como: 'service',
    metodo: 'DELETE',
  });
  const r = await rest(
    `rank_positions?select=*&subject_type=eq.episode&subject_id=eq.${EP}&user_id=eq.${U.carla}`,
    { como: 'ana' },
  );
  const passou = vazio(r);
  await rest('watched', {
    como: 'service',
    metodo: 'POST',
    corpo: { user_id: U.ana, episode_id: EP },
  });
  return { passou, detalhe: r.texto.slice(0, 140) };
});

await ataque('A12', 'ler o Círculo de outra pessoa', async () => {
  const r = await rest(`circle_members?select=*&owner_id=eq.${U.ana}`, { como: 'david' });
  return { passou: vazio(r), detalhe: r.texto.slice(0, 120) };
});

await ataque('A13', 'pôr-me no Círculo de alguém sem reciprocidade', async () => {
  const r = await rest('circle_members', {
    metodo: 'POST',
    corpo: { owner_id: U.ana, member_id: U.fabio },
  });
  return { passou: r.estado >= 400, detalhe: `${r.estado} · ${r.texto.slice(0, 120)}` };
});

await ataque('A14', 'contornar o limite de 30 pondo circle_count a zero', async () => {
  const r = await rest(`profiles?id=eq.${U.ana}`, {
    como: 'ana',
    metodo: 'PATCH',
    corpo: { circle_count: 0 },
  });
  const verdade = await rest(`profiles?select=circle_count&id=eq.${U.ana}`, {
    como: 'service',
  });
  const contador = verdade.corpo?.[0]?.circle_count;
  return {
    passou: r.estado >= 400 && contador === 1,
    detalhe: `${r.estado} · contador continua ${contador} · ${r.texto.slice(0, 100)}`,
  };
});

// ── Grupo 4 · Bloqueio ───────────────────────────────────────────────────────

const superficies = [
  ['profiles', `profiles?select=*&id=eq.${U.ana}`],
  ['profile_cards', `profile_cards?select=*&id=eq.${U.ana}`],
  ['rank_positions', `rank_positions?select=*&user_id=eq.${U.ana}`],
  ['buckets', `buckets?select=*&user_id=eq.${U.ana}`],
  ['scores', `scores?select=*&user_id=eq.${U.ana}`],
  ['replies', `replies?select=*&target_user_id=eq.${U.ana}`],
  ['reactions', `reactions?select=*&target_user_id=eq.${U.ana}`],
  ['taste_match', `taste_match?select=*&user_a=eq.${U.ana}`],
  ['watched', `watched?select=*&user_id=eq.${U.ana}`],
];

await ataque('A15', 'bloqueado vê alguma coisa de quem o bloqueou', async () => {
  const fugas = [];
  for (const [nome, caminho] of superficies) {
    const r = await rest(caminho, { como: 'eva' });
    if (!vazio(r)) fugas.push(`${nome}=${r.estado}:${r.texto.slice(0, 60)}`);
  }
  return {
    passou: fugas.length === 0,
    detalhe: fugas.join(' | ') || 'nenhuma superfície',
  };
});

await ataque('A16', 'quem bloqueou vê alguma coisa de quem bloqueou', async () => {
  const fugas = [];
  for (const [nome, caminho] of superficies) {
    const r = await rest(caminho.replaceAll(U.ana, U.eva), { como: 'ana' });
    if (!vazio(r)) fugas.push(`${nome}=${r.estado}:${r.texto.slice(0, 60)}`);
  }
  return {
    passou: fugas.length === 0,
    detalhe: fugas.join(' | ') || 'nenhuma superfície',
  };
});

// ── Grupo 5 · Escrita ────────────────────────────────────────────────────────

await ataque('A17', 'escrever em nome de outro user_id', async () => {
  const r = await rest('buckets', {
    metodo: 'POST',
    corpo: { user_id: U.ana, subject_type: 'movie', subject_id: FILME, bucket: 'nah' },
  });
  return { passou: r.estado >= 400, detalhe: `${r.estado} · ${r.texto.slice(0, 100)}` };
});

await ataque('A18', 'escrever a própria e depois mudar o dono', async () => {
  await rest('buckets', {
    metodo: 'POST',
    corpo: { user_id: U.fabio, subject_type: 'movie', subject_id: FILME, bucket: 'nah' },
  });
  const r = await rest(`buckets?user_id=eq.${U.fabio}`, {
    metodo: 'PATCH',
    corpo: { user_id: U.ana },
  });
  await rest(`buckets?user_id=eq.${U.fabio}`, { metodo: 'DELETE' });
  return { passou: r.estado >= 400, detalhe: `${r.estado} · ${r.texto.slice(0, 100)}` };
});

await ataque('A19', 'exceder 140 caracteres por chamada directa', async () => {
  const r = await rest('replies', {
    como: 'carla',
    metodo: 'POST',
    corpo: {
      user_id: U.carla,
      target_user_id: U.ana,
      target_subject_type: 'movie',
      target_subject_id: FILME,
      body: 'a'.repeat(141),
    },
  });
  return { passou: r.estado >= 400, detalhe: `${r.estado} · ${r.texto.slice(0, 100)}` };
});

await ataque('A20', 'responder a uma nota estando fora do Círculo', async () => {
  const r = await rest('replies', {
    como: 'david',
    metodo: 'POST',
    corpo: {
      user_id: U.david,
      target_user_id: U.ana,
      target_subject_type: 'movie',
      target_subject_id: FILME,
      body: 'olá',
    },
  });
  return { passou: r.estado >= 400, detalhe: `${r.estado} · ${r.texto.slice(0, 100)}` };
});

// ── Grupo 6 · Superfície do PostgREST ────────────────────────────────────────

await ataque('A21', 'ler por return=representation numa escrita', async () => {
  // Escrever numa tabela e pedir a representação de volta não pode devolver
  // linhas que a política de leitura esconderia.
  const r = await rest('buckets', {
    metodo: 'POST',
    corpo: { user_id: U.fabio, subject_type: 'movie', subject_id: FILME, bucket: 'nah' },
    prefer: 'return=representation',
  });
  const so_minhas =
    Array.isArray(r.corpo) && r.corpo.every((linha) => linha.user_id === U.fabio);
  await rest(`buckets?user_id=eq.${U.fabio}`, { metodo: 'DELETE' });
  return { passou: so_minhas, detalhe: `${r.estado} · ${r.texto.slice(0, 120)}` };
});

await ataque('A22', 'usar on_conflict como oráculo de existência', async () => {
  // Um upsert sobre uma linha da ana: se o conflito for detectado e a resposta
  // for diferente de um upsert sobre uma linha que não existe, isso diz-me que
  // a linha da ana existe — informação que a RLS esconde.
  const conflito = await rest('buckets?on_conflict=user_id,subject_type,subject_id', {
    metodo: 'POST',
    corpo: { user_id: U.ana, subject_type: 'movie', subject_id: FILME, bucket: 'nah' },
    prefer: 'resolution=merge-duplicates',
  });
  const semConflito = await rest('buckets?on_conflict=user_id,subject_type,subject_id', {
    metodo: 'POST',
    corpo: {
      user_id: U.ana,
      subject_type: 'movie',
      subject_id: INEXISTENTE,
      bucket: 'nah',
    },
    prefer: 'resolution=merge-duplicates',
  });
  return {
    passou: conflito.estado >= 400 && conflito.estado === semConflito.estado,
    detalhe: `conflito ${conflito.estado} · sem conflito ${semConflito.estado}`,
  };
});

await ataque('A23', 'agregar para inferir o que não se pode ler', async () => {
  const r = await rest('rank_positions?select=subject_id,position.avg()', {
    prefer: 'count=exact',
  });
  const revelou =
    Array.isArray(r.corpo) && r.corpo.some((l) => l.avg !== null && l.avg !== undefined);
  return { passou: !revelou, detalhe: `${r.estado} · ${r.texto.slice(0, 140)}` };
});

await ataque('A27', 'chamar as funções internas por RPC', async () => {
  const purga = await rest('rpc/purgar_retencao', { metodo: 'POST', corpo: {} });
  const renumerar = await rest('rpc/renumerar_ambito', {
    metodo: 'POST',
    corpo: {
      p_user: U.ana,
      p_subject_type: 'movie',
      p_scope: '00000000-0000-0000-0000-000000000000',
    },
  });
  // `renumerar_ambito` é security invoker, portanto correr sobre o âmbito de
  // outra pessoa não escreve nada: a RLS não deixa. O que não pode acontecer é
  // devolver um número diferente de zero.
  const naoMexeu = renumerar.estado >= 400 || renumerar.corpo === 0;
  return {
    passou: purga.estado >= 400 && naoMexeu,
    detalhe: `purgar ${purga.estado} · renumerar ${renumerar.estado}/${JSON.stringify(renumerar.corpo)}`,
  };
});

await ataque('A28', 'entrar com JWT forjado, expirado, ou sem sessão', async () => {
  const forjado = await rest('rank_positions?select=*', {
    jwt: token('ana', { segredo: 'segredo-errado-mas-do-mesmo-tamanho-1234' }),
  });
  const expirado = await rest('rank_positions?select=*', {
    jwt: token('ana', { expirado: true }),
  });
  const anonimo = await rest('rank_positions?select=*', { jwt: ANON });

  return {
    passou: forjado.estado === 401 && expirado.estado === 401 && vazio(anonimo),
    detalhe: `forjado ${forjado.estado} · expirado ${expirado.estado} · anon ${anonimo.estado}:${anonimo.texto.slice(0, 40)}`,
  };
});

await ataque(
  'A29',
  'escalar para service_role sem conhecer o segredo do JWT',
  async () => {
    // Um JWT que reclame `role: service_role` mas venha assinado com outro
    // segredo é recusado. Assinado com o segredo VERDADEIRO, é aceite e ignora a
    // RLS por completo — verificado, e é o comportamento correcto do Postgres,
    // não um bug: quem tem o segredo do JWT tem tudo, porque é com ele que se
    // emite a própria chave service_role.
    //
    // A conclusão operacional não é «corrigir a política». É que o segredo do
    // JWT nunca entra num bundle nem num repositório, e que rodá-lo é a resposta
    // a qualquer suspeita de fuga. Está em docs/ambientes.md.
    const semSegredo = await rest('rank_positions?select=*', {
      jwt: token('ana', {
        role: 'service_role',
        segredo: 'segredo-errado-mas-do-mesmo-tamanho-1234',
      }),
    });
    return {
      passou: semSegredo.estado === 401,
      detalhe: `sem o segredo: ${semSegredo.estado}`,
    };
  },
);

// ── Veredicto ────────────────────────────────────────────────────────────────

const falhas = resultados.filter((r) => !r.passou);

for (const r of resultados) {
  const marca = r.passou ? 'falhou (bom)' : 'PASSOU (MAU)';
  process.stdout.write(`${r.id.padEnd(4)} ${marca.padEnd(13)} ${r.nome}\n`);
  if (!r.passou) process.stdout.write(`       ${r.detalhe}\n`);
}

process.stdout.write(
  `\n${resultados.length} ataques, ${falhas.length} bem sucedidos contra nós.\n`,
);

if (falhas.length > 0) {
  process.stdout.write('\nVeredicto: BLOQUEIA. A Fase 1 não fecha.\n');
  process.exit(1);
}

process.stdout.write('\nVeredicto: PASSA nesta bateria.\n');
process.stdout.write(
  'Não testado aqui: Realtime (A26, configuração separada) e os oráculos de\n' +
    'latência (A4b), que precisam de volume de dados para dizerem alguma coisa.\n',
);

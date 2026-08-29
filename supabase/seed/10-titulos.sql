-- F0-4 · Metadados
--
-- Fixtures mínimas, com UUID fixo pela mesma razão das contas. Não vêm do TMDB
-- e nunca virão num teste: o CI não faz uma única chamada externa.

insert into public.titles (id, tmdb_id, kind, title, year, poster_path, lang) values
  ('aaaa0001-0000-4000-8000-000000000001', 550,    'movie', 'Clube de Combate',  1999, '/fight.jpg',   'en'),
  ('aaaa0002-0000-4000-8000-000000000002', 27205,  'movie', 'A Origem',          2010, '/inception.jpg','en'),
  ('aaaa0003-0000-4000-8000-000000000003', 680,    'movie', 'Pulp Fiction',      1994, '/pulp.jpg',    'en'),
  ('bbbb0001-0000-4000-8000-000000000001', 1396,   'tv',    'Breaking Bad',      2008, '/bb.jpg',      'en'),
  ('bbbb0002-0000-4000-8000-000000000002', 1399,   'tv',    'A Guerra dos Tronos', 2011, '/got.jpg',   'en');

insert into public.seasons (id, title_id, number, name) values
  ('cccc0001-0000-4000-8000-000000000001', 'bbbb0001-0000-4000-8000-000000000001', 1, 'Temporada 1'),
  ('cccc0002-0000-4000-8000-000000000002', 'bbbb0002-0000-4000-8000-000000000002', 1, 'Temporada 1');

insert into public.episodes (id, season_id, number, name, air_date) values
  ('dddd0001-0000-4000-8000-000000000001', 'cccc0001-0000-4000-8000-000000000001', 1, 'Piloto',            '2008-01-20'),
  ('dddd0002-0000-4000-8000-000000000002', 'cccc0001-0000-4000-8000-000000000001', 2, 'O Gato Está no Saco','2008-01-27'),
  ('dddd0003-0000-4000-8000-000000000003', 'cccc0002-0000-4000-8000-000000000002', 1, 'O Inverno Está a Chegar', '2011-04-17');

-- F0-4 · Contas de teste
--
-- Seis contas de UUID fixo. São elas que o `rls-adversary` usa para atacar, e é
-- por isso que os UUID são literais e não gerados: um relatório de ataque tem
-- de poder citar `11111111-…` e a pessoa que o lê reproduzir exactamente a
-- mesma linha, hoje e daqui a três meses.
--
--   ana    pública
--   bruno  privado, sem relação com a ana
--   carla  privada, no Círculo da ana (e a ana no dela)
--   david  pediu para seguir a ana — mas a ana é pública, por isso segue-a já;
--          o pedido pendente que interessa é o dele para a carla
--   eva    bloqueada pela ana
--   fabio  estranho, sem uma única relação
--
-- Palavra-passe de todas: nota-teste-1234

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  -- Estas quatro colunas são nullable no esquema, mas o GoTrue lê-as como
  -- texto e não como texto-que-pode-ser-nulo. Deixá-las a NULL faz o login
  -- responder «Database error querying schema», que não diz nada sobre a
  -- causa. Uma conta de teste que não consegue fazer login a sério não serve
  -- para testar o que a app faz.
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000',
  c.id,
  'authenticated',
  'authenticated',
  c.handle || '@nota.test',
  extensions.crypt('nota-teste-1234', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('handle', c.handle, 'display_name', c.nome),
  now(),
  now(),
  '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'ana',   'Ana'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'bruno', 'Bruno'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'carla', 'Carla'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'david', 'David'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'eva',   'Eva'),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'fabio', 'Fábio')
) as c (id, handle, nome);

-- Identidades, para o login por email funcionar.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u;

-- O trigger `on_auth_user_created` já criou os perfis, todos privados por
-- omissão — que é o ponto da regra 2. Só a ana passa a pública, e é uma
-- escrita explícita.
update public.profiles
   set is_private = false
 where handle = 'ana';

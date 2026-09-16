/**
 * Núcleo da sincronização (sem dependências): recebe o que o app empurrou e
 * devolve o que mudou desde o cursor. Separado do banco para dar para testar.
 *
 * Modelo:
 *  - Eventos sincronizam um a um (append + edição + tombstone de exclusão),
 *    então dois celulares registrando ao mesmo tempo NÃO se sobrescrevem.
 *  - O "perfil" (bebê, ajustes, remédios) sincroniza por última-edição-vence.
 *  - Os cronômetros EM ANDAMENTO (mamada, sono, arroto) sincronizam um a um,
 *    por tipo, também por última-edição-vence: quem começa uma soneca no seu
 *    celular faz ela aparecer no do parceiro, e quem encerra apaga nos dois.
 *
 * O `db` injetado precisa expor (todos async):
 *   now()                         -> epoch ms do relógio do banco
 *   getEventsSince(key, sinceMs)  -> [{ id, data, deleted, updatedMs }]
 *   upsertEvents(key, events)     -> grava [{ id, data, deleted }] com updated_at=now()
 *   getProfile(key)               -> { data, updatedMs } | null
 *   upsertProfile(key, data)      -> grava o perfil com updated_at=now()
 *   getActiveSince(key, sinceMs)  -> [{ kind, data, updatedMs }]  (data null = parado)
 *   upsertActive(key, items)      -> grava [{ kind, data }] com updated_at=now()
 */

export const MAX_EVENTS_PER_SYNC = 1000;

/** Cronômetros que sincronizam em andamento (espelha o store do cliente). */
export const ACTIVE_KINDS = ['feed', 'sleep', 'burp'];

/** Limpa um evento vindo do cliente para gravar (sem campos locais). */
export function sanitizeEvent(ev) {
  if (!ev || typeof ev.id !== 'string' || !ev.id) return null;
  const data = { ...ev };
  delete data._dirty;
  delete data.deleted;
  return { id: ev.id.slice(0, 64), data, deleted: !!ev.deleted };
}

/**
 * Normaliza o bloco `active` do push: só os tipos conhecidos e só as chaves
 * que o cliente realmente mandou. `null` é um valor de verdade aqui — quer
 * dizer "parei o cronômetro" —, então a chave ausente (não mexi) e a chave
 * nula (encerrei) são coisas diferentes.
 */
export function sanitizeActive(active) {
  if (!active || typeof active !== 'object' || Array.isArray(active)) return [];
  const out = [];
  for (const kind of ACTIVE_KINDS) {
    if (!Object.prototype.hasOwnProperty.call(active, kind)) continue;
    const valor = active[kind];
    if (valor == null) { out.push({ kind, data: null }); continue; }
    if (typeof valor !== 'object' || Array.isArray(valor)) continue;
    out.push({ kind, data: valor });
  }
  return out;
}

/**
 * Aplica o push e devolve o pull. `familyKey` já vem resolvido (hash) do wrapper.
 * `since` é o cursor (epoch ms do servidor) da última resposta que o app viu.
 */
export async function applySync(db, { familyKey, since = 0, events = [], profile = null, active = null } = {}) {
  if (!familyKey) throw new Error('familyKey ausente');

  const limpos = (Array.isArray(events) ? events : [])
    .slice(0, MAX_EVENTS_PER_SYNC)
    .map(sanitizeEvent)
    .filter(Boolean);
  if (limpos.length) await db.upsertEvents(familyKey, limpos);

  if (profile && profile.data && typeof profile.data === 'object') {
    await db.upsertProfile(familyKey, profile.data);
  }

  const ativos = sanitizeActive(active);
  if (ativos.length && db.upsertActive) await db.upsertActive(familyKey, ativos);

  // now() antes do pull: itens escritos entre agora e a leitura podem voltar
  // de novo na próxima vez (idempotente no cliente), mas nada é perdido.
  const now = await db.now();
  const cursor = Number(since) || 0;
  const changed = await db.getEventsSince(familyKey, cursor);
  const prof = await db.getProfile(familyKey);
  const ativosMudados = db.getActiveSince ? await db.getActiveSince(familyKey, cursor) : [];

  return {
    now,
    events: changed.map((e) => ({ id: e.id, data: e.data, deleted: !!e.deleted, updatedMs: e.updatedMs })),
    profile: prof ? { data: prof.data, updatedMs: prof.updatedMs } : null,
    active: ativosMudados.map((a) => ({ kind: a.kind, data: a.data ?? null, updatedMs: a.updatedMs })),
  };
}

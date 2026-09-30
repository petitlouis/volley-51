import './style.css';
import { buildFlow, type FlowSetup, type Node, type StartKind } from './model/flow';
import { isFrontRow, label, ROLE_NAME, ROLE_OF, roleColor } from './model/roles';
import { lineup, POSTES } from './model/rotation';
import type { ReceptionMode } from './model/types';
import { CourtView, type ViewOptions } from './view/court';

const setup: FlowSetup = { kind: 'service', rotation: 1, libero: true, receptionMode: 5 };
let choices: string[] = [];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const view = new CourtView($('court'));

const DURATIONS = [0, 1600, 900, 500, 250];

function viewOptions(): ViewOptions {
  return {
    radii: $<HTMLInputElement>('radii').checked,
    traces: $<HTMLInputElement>('traces').checked,
    angles: $<HTMLInputElement>('angles').checked,
  };
}

function buttons<T extends string | number>(
  host: HTMLElement,
  items: { value: T; text: string }[],
  current: T,
  onPick: (v: T) => void,
): void {
  host.replaceChildren(
    ...items.map((it) => {
      const b = document.createElement('button');
      b.textContent = it.text;
      b.classList.toggle('active', it.value === current);
      b.addEventListener('click', () => onPick(it.value));
      return b;
    }),
  );
}

function restart(): void {
  choices = [];
  // Numéro de version dans le pied de page, avec un lien vers la release correspondante.
const version = $<HTMLAnchorElement>('version');
version.textContent = `v${__APP_VERSION__}`;
version.href = `https://github.com/petitlouis/volley-51/releases/tag/v${__APP_VERSION__}`;

render();
}

function render(): void {
  const nodes = buildFlow(setup, choices);
  const node = nodes[nodes.length - 1];
  const prev = nodes.length > 1 ? nodes[nodes.length - 2] : null;

  buttons<StartKind>(
    $('kind'),
    [{ value: 'service', text: 'Nous servons' }, { value: 'reception', text: 'Nous réceptionnons' }],
    setup.kind,
    (v) => { setup.kind = v; restart(); },
  );
  buttons(
    $('rotations'),
    [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, text: String(n) })),
    setup.rotation,
    (v) => { setup.rotation = v; restart(); },
  );
  buttons<ReceptionMode>(
    $('receptionMode'),
    [{ value: 4, text: 'À 4' }, { value: 5, text: 'À 5' }],
    setup.receptionMode,
    (v) => { setup.receptionMode = v; restart(); },
  );
  $('receptionItem').hidden = setup.kind !== 'reception';

  view.setDuration(DURATIONS[Number($<HTMLInputElement>('speed').value)]);
  view.update(node.scene, prev?.scene ?? null, viewOptions(), [setup.kind, setup.rotation, setup.libero, setup.receptionMode, ...choices].join('|'));
  $('stepTitle').textContent = node.title;
  $('stepText').textContent = node.text;
  renderQuestion(node);
  renderHistory(nodes);
  renderLegend();
  $<HTMLButtonElement>('undo').disabled = choices.length === 0;
}

function renderQuestion(node: Node): void {
  $('questionBox').hidden = node.question === null;
  $('endBox').hidden = node.question !== null;
  $('question').textContent = node.question ?? '';
  $('options').replaceChildren(
    ...node.options.map((o) => {
      const b = document.createElement('button');
      b.className = 'option';
      const t = document.createElement('strong');
      t.textContent = o.label;
      b.append(t);
      if (o.hint) {
        const h = document.createElement('span');
        h.textContent = o.hint;
        b.append(h);
      }
      b.addEventListener('click', () => { choices = [...choices, o.id]; render(); });
      return b;
    }),
  );
}

function renderHistory(nodes: Node[]): void {
  $('history').replaceChildren(
    ...nodes.map((n, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.textContent = n.title;
      b.classList.toggle('current', i === nodes.length - 1);
      b.addEventListener('click', () => { choices = choices.slice(0, i); render(); });
      li.append(b);
      return li;
    }),
  );
}

function renderLegend(): void {
  const lu = lineup(setup.rotation);
  const rows = POSTES.map((p) => {
    const id = lu[p];
    const front = isFrontRow(id, p);
    return {
      color: roleColor(ROLE_OF[id], front),
      text: `${label(id, p)} : ${ROLE_NAME[ROLE_OF[id]]}, ligne ${front ? 'avant' : 'arrière'}${p === 1 ? ', sert' : ''}`,
    };
  });
  if (setup.libero) {
    rows.push({ color: roleColor('L', false), text: "L : Libéro, ligne arrière, n'attaque jamais" });
  }
  $('legend').replaceChildren(
    ...rows.map((r) => {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = r.color;
      li.append(sw, r.text);
      return li;
    }),
  );
}

const undo = (): void => { if (choices.length > 0) { choices = choices.slice(0, -1); render(); } };
$('undo').addEventListener('click', undo);
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (e.key === 'Backspace' && t.tagName !== 'INPUT' && t.tagName !== 'SELECT') { e.preventDefault(); undo(); }
});
$('restart').addEventListener('click', restart);
$('speed').addEventListener('input', render);
$<HTMLInputElement>('libero').addEventListener('change', (e) => {
  setup.libero = (e.target as HTMLInputElement).checked;
  restart();
});
for (const id of ['radii', 'traces', 'angles']) $(id).addEventListener('change', render);

// Numéro de version dans le pied de page, avec un lien vers la release correspondante.
const version = $<HTMLAnchorElement>('version');
version.textContent = `v${__APP_VERSION__}`;
version.href = `https://github.com/petitlouis/volley-51/releases/tag/v${__APP_VERSION__}`;

render();

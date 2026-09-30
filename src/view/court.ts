import { ALL_IDS, isFrontRow, label, ROLE_COLOR_BACK, ROLE_COLOR_FRONT, roleColor } from '../model/roles';
import type { PlayerId, Point, Scene } from '../model/types';

const NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

export interface ViewOptions {
  radii: boolean;
  traces: boolean;
  angles: boolean;
}

interface PlayerNode {
  g: SVGGElement;
  halo: SVGCircleElement;
  disc: SVGCircleElement;
  text: SVGTextElement;
}

const uid = (() => {
  let n = 0;
  return () => `c${++n}`;
})();

export class CourtView {
  private readonly svg: SVGSVGElement;
  private readonly overlay: SVGGElement;
  private readonly traces: SVGGElement;
  private readonly nodes = new Map<PlayerId, PlayerNode>();
  private readonly patternId = uid();
  private readonly ballLayer: SVGGElement;
  private readonly ballEl: SVGGElement;
  private lastKey: string | null = null;
  private ballAnim: Animation | undefined;
  private duration = 900;

  constructor(host: HTMLElement) {
    this.svg = svg('svg', {
      viewBox: '-3 -10.5 15 23',
      class: 'court',
      role: 'img',
      'aria-label': 'Terrain de volley vu de dessus',
    });
    this.drawDefs();
    this.drawCourt();
    this.traces = svg('g', { class: 'traces' }, this.svg);
    this.overlay = svg('g', { class: 'overlay' }, this.svg);
    const layer = svg('g', { class: 'players' }, this.svg);
    for (const id of ALL_IDS) {
      const g = svg('g', { class: 'player' }, layer);
      const halo = svg('circle', { r: 2, class: 'halo' }, g);
      const disc = svg('circle', { r: 0.75, class: 'disc' }, g);
      const text = svg('text', { class: 'lbl', 'text-anchor': 'middle', dy: '0.16' }, g);
      this.nodes.set(id, { g, halo, disc, text });
    }
    this.ballLayer = svg('g', { class: 'ball-layer' }, this.svg);
    this.ballEl = svg('g', { class: 'ball-dot' }, this.ballLayer);
    svg('circle', { r: 0.36, class: 'ball-body' }, this.ballEl);
    svg('path', { d: 'M-0.36,0 Q0,-0.2 0.36,0 M-0.36,0 Q0,0.2 0.36,0 M0,-0.36 Q0.2,0 0,0.36', class: 'ball-seam' }, this.ballEl);
    host.replaceChildren(this.svg);
  }

  setDuration(ms: number): void {
    this.duration = ms;
    this.svg.style.setProperty('--dur', `${ms}ms`);
  }

  private drawDefs(): void {
    const defs = svg('defs', {}, this.svg);
    const hatches = [
      ...Object.entries(ROLE_COLOR_FRONT).map(([role, color]) => [`${role}-f`, color] as const),
      ...Object.entries(ROLE_COLOR_BACK).map(([role, color]) => [`${role}-b`, color] as const),
    ];
    for (const [key, color] of hatches) {
      const p = svg(
        'pattern',
        { id: `${this.patternId}-${key}`, width: 0.28, height: 0.28, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        defs,
      );
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 0.28, stroke: color, 'stroke-width': 0.07 }, p);
    }
    const arrow = svg(
      'marker',
      { id: `${this.patternId}-arrow`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' },
      defs,
    );
    svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#c0392b' }, arrow);
  }

  private drawCourt(): void {
    const s = this.svg;
    svg('rect', { x: -3, y: -10.5, width: 15, height: 23, class: 'outside' }, s);
    svg('rect', { x: 0, y: -9, width: 9, height: 9, class: 'court-opp' }, s);
    svg('rect', { x: 0, y: 0, width: 9, height: 9, class: 'court-our' }, s);
    svg('line', { x1: 0, y1: 3, x2: 9, y2: 3, class: 'line' }, s);
    svg('line', { x1: 0, y1: -3, x2: 9, y2: -3, class: 'line faint' }, s);
    svg('line', { x1: -0.6, y1: 0, x2: 9.6, y2: 0, class: 'net' }, s);
    const postes: [number, number, number][] = [
      [1, 7.5, 7], [2, 7.5, 2], [3, 4.5, 2], [4, 1.5, 2], [5, 1.5, 7], [6, 4.5, 7],
    ];
    for (const [n, x, y] of postes) {
      const t = svg('text', { x, y: y + 0.35, class: 'poste', 'text-anchor': 'middle' }, s);
      t.textContent = String(n);
    }
    const f = svg('text', { x: 4.5, y: -0.25, class: 'note', 'text-anchor': 'middle' }, s);
    f.textContent = 'FILET';
    const a = svg('text', { x: 4.5, y: -9.3, class: 'note', 'text-anchor': 'middle' }, s);
    a.textContent = 'Terrain adverse';
    const b = svg('text', { x: -1.5, y: 7.2, class: 'note', 'text-anchor': 'middle' }, s);
    b.textContent = 'Banc';
  }

  /** `key` identifie le coup affiché : la balle ne rejoue son trajet que quand il change. */
  update(scene: Scene, prev: Scene | null, opts: ViewOptions, key: string): void {
    for (const p of scene.players) {
      const n = this.nodes.get(p.id)!;
      n.g.style.transform = `translate(${p.x}px, ${p.y}px)`;
      n.g.classList.toggle('off', !p.onCourt);
      n.g.classList.toggle('hitter', scene.overlay.hitter === p.id);
      const front = isFrontRow(p.id, p.poste);
      const color = roleColor(p.role, front);
      n.disc.setAttribute('fill', color);
      n.disc.setAttribute('stroke', p.role === 'L' ? '#7a6500' : '#ffffff');
      n.text.textContent = label(p.id, p.poste ?? undefined);
      // Texte sombre sur les teintes claires (ligne avant et libéro), blanc sur les teintes foncées.
      n.text.setAttribute('fill', front || p.role === 'L' ? '#1b1b1b' : '#fff');
      n.text.style.fontSize = '0.44px';
      n.halo.setAttribute('r', String(Math.max(p.radius, 0.01)));
      n.halo.setAttribute('fill', `url(#${this.patternId}-${p.role}-${front ? 'f' : 'b'})`);
      n.halo.setAttribute('stroke', color);
      n.halo.style.display = opts.radii && p.onCourt ? '' : 'none';
    }
    this.drawTraces(scene, prev, opts);
    this.drawOverlay(scene, opts);
    this.drawBall(scene, key);
    this.lastKey = key;
  }

  /** La balle suit son trajet point par point ; sans changement de coup elle reste à sa place finale. */
  private drawBall(scene: Scene, key: string): void {
    this.ballAnim?.cancel();
    const path = scene.overlay.ballPath;
    if (!path || path.length === 0) {
      this.ballEl.style.display = 'none';
      return;
    }
    this.ballEl.style.display = '';
    const last = path[path.length - 1];
    this.ballEl.style.transform = `translate(${last.x}px, ${last.y}px)`;
    if (path.length < 2) return;
    svg('polyline', { points: path.map((p) => `${p.x},${p.y}`).join(' '), class: 'trail' }, this.overlay);
    if (key === this.lastKey || this.duration <= 0) return;
    const legs = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y) + 0.5);
    const total = legs.reduce((a, b) => a + b, 0);
    let acc = 0;
    const frames: Keyframe[] = path.map((p, i) => {
      if (i > 0) acc += legs[i - 1];
      return { transform: `translate(${p.x}px, ${p.y}px)`, offset: acc / total };
    });
    this.ballAnim = this.ballEl.animate(frames, {
      duration: this.duration * 1.8 + 400,
      delay: this.duration * 0.25,
      easing: 'ease-in-out',
      fill: 'both',
    });
  }

  private drawTraces(scene: Scene, prev: Scene | null, opts: ViewOptions): void {
    this.traces.replaceChildren();
    if (!prev || !opts.traces) return;
    for (const p of scene.players) {
      const q = prev.players.find((x) => x.id === p.id)!;
      if (!p.onCourt || !q.onCourt) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) < 0.3) continue;
      svg('line', { x1: q.x, y1: q.y, x2: p.x, y2: p.y, class: 'trace' }, this.traces);
    }
  }

  private drawOverlay(scene: Scene, opts: ViewOptions): void {
    this.overlay.replaceChildren();
    const o = scene.overlay;
    if (o.opponent) this.drawOpponent(o.opponent);
    if (o.landing) this.drawLanding(o.landing);
    if (o.ball) svg('circle', { cx: o.ball.x, cy: o.ball.y, r: 1.05, class: 'ball' }, this.overlay);
    if (o.angles && opts.angles) {
      const { from, lines } = o.angles;
      for (const l of lines) {
        svg(
          'line',
          { x1: from.x, y1: from.y, x2: l.to.x, y2: l.to.y, class: 'angle', 'marker-end': `url(#${this.patternId}-arrow)` },
          this.overlay,
        );
        this.angleLabel(from, l.to, l.label);
      }
      svg('circle', { cx: from.x, cy: from.y, r: 0.16, class: 'from' }, this.overlay);
    }
  }

  private drawLanding(p: Point): void {
    const r = 0.45;
    svg('line', { x1: p.x - r, y1: p.y - r, x2: p.x + r, y2: p.y + r, class: 'landing' }, this.overlay);
    svg('line', { x1: p.x - r, y1: p.y + r, x2: p.x + r, y2: p.y - r, class: 'landing' }, this.overlay);
  }

  private angleLabel(from: Point, to: Point, text: string): void {
    const t = svg('text', { x: to.x, y: to.y - 0.35, class: 'angle-label', 'text-anchor': 'middle' }, this.overlay);
    t.textContent = text;
    t.setAttribute('data-from', `${from.x}`);
  }

  private drawOpponent(o: Point & { label: string }): void {
    svg('circle', { cx: o.x, cy: o.y, r: 0.7, class: 'opp' }, this.overlay);
    svg(
      'line',
      { x1: o.x, y1: o.y + 0.8, x2: o.x, y2: o.y + 2.6, class: 'angle', 'marker-end': `url(#${this.patternId}-arrow)` },
      this.overlay,
    );
    const t = svg('text', { x: o.x, y: o.y - 1.0, class: 'angle-label', 'text-anchor': 'middle' }, this.overlay);
    t.textContent = o.label;
  }
}

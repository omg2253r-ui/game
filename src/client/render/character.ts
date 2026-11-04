/**
 * Procedurally built anime hunter with a joint hierarchy animated by THREE.AnimationMixer
 * keyframe clips (idle, walk, run, attacks per weapon class, skill, ultimate, hit, dodge,
 * defend, victory, defeat).
 */
import * as THREE from 'three';
import type { Appearance } from '../../core/types';
import { WEAPON_MAP, type WeaponClass } from '../../core/data/weapons';
import { box, capsule, cone, cyl, geo, glow, part, sphere, toon, torus } from './toon';
import { eyeTexture, mouthTexture } from './textures';

type V3 = [number, number, number];
type Pose = Record<string, V3>;
interface ClipDef {
  dur: number;
  loop: boolean;
  keys: [number, Pose][];
  pos?: [number, V3][];
  hit?: number; // time of impact (s)
  hits?: number[]; // multi-hit impact times
}

const D = Math.PI / 180;
const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'thL', 'knL', 'thR', 'knR'];
const HIP_Y = 0.92;

const holdR: Pose = { shR: [-18, 0, -6], elR: [-45, 0, 0] };
const IDLE_BASE: Pose = { shL: [4, 0, 9], elL: [-12, 0, 0], ...holdR };

function clipsFor(cls: WeaponClass): Record<string, ClipDef> {
  const ranged = cls === 'rifle' || cls === 'railgun';
  const idle: ClipDef = {
    dur: 2.4, loop: true,
    keys: [
      [0, { ...IDLE_BASE, chest: [0, 0, 0], head: [0, 0, 0] }],
      [1.2, { ...IDLE_BASE, shL: [2, 0, 11], chest: [-3, 0, 0], head: [3, 4, 0] }],
      [2.4, { ...IDLE_BASE, chest: [0, 0, 0], head: [0, 0, 0] }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [1.2, [0, HIP_Y - 0.012, 0]], [2.4, [0, HIP_Y, 0]]],
  };
  const walk: ClipDef = {
    dur: 0.9, loop: true,
    keys: [
      [0, { thL: [-26, 0, 0], knL: [6, 0, 0], thR: [22, 0, 0], knR: [30, 0, 0], shL: [24, 0, 8], shR: [-30, 0, -6], elR: [-40, 0, 0], chest: [4, 6, 0] }],
      [0.45, { thL: [22, 0, 0], knL: [30, 0, 0], thR: [-26, 0, 0], knR: [6, 0, 0], shL: [-22, 0, 8], shR: [-8, 0, -6], elR: [-50, 0, 0], chest: [4, -6, 0] }],
      [0.9, { thL: [-26, 0, 0], knL: [6, 0, 0], thR: [22, 0, 0], knR: [30, 0, 0], shL: [24, 0, 8], shR: [-30, 0, -6], elR: [-40, 0, 0], chest: [4, 6, 0] }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.225, [0, HIP_Y + 0.03, 0]], [0.45, [0, HIP_Y, 0]], [0.675, [0, HIP_Y + 0.03, 0]], [0.9, [0, HIP_Y, 0]]],
  };
  const run: ClipDef = {
    dur: 0.56, loop: true,
    keys: [
      [0, { thL: [-50, 0, 0], knL: [20, 0, 0], thR: [35, 0, 0], knR: [80, 0, 0], shL: [45, 0, 12], elL: [-70, 0, 0], shR: [-40, 0, -14], elR: [-70, 0, 0], chest: [14, 10, 0], head: [-8, 0, 0] }],
      [0.28, { thL: [35, 0, 0], knL: [80, 0, 0], thR: [-50, 0, 0], knR: [20, 0, 0], shL: [-45, 0, 12], elL: [-70, 0, 0], shR: [30, 0, -14], elR: [-70, 0, 0], chest: [14, -10, 0], head: [-8, 0, 0] }],
      [0.56, { thL: [-50, 0, 0], knL: [20, 0, 0], thR: [35, 0, 0], knR: [80, 0, 0], shL: [45, 0, 12], elL: [-70, 0, 0], shR: [-40, 0, -14], elR: [-70, 0, 0], chest: [14, 10, 0], head: [-8, 0, 0] }],
    ],
    pos: [[0, [0, HIP_Y - 0.02, 0]], [0.14, [0, HIP_Y + 0.07, 0]], [0.28, [0, HIP_Y - 0.02, 0]], [0.42, [0, HIP_Y + 0.07, 0]], [0.56, [0, HIP_Y - 0.02, 0]]],
  };

  const attacks: Record<string, ClipDef> = {
    slash: {
      dur: 0.85, loop: false, hit: 0.38,
      keys: [
        [0, { ...IDLE_BASE }],
        [0.22, { shR: [-60, 0, -110], elR: [-30, 0, 0], chest: [0, 35, 0], shL: [-20, 0, 30], thL: [-20, 0, 0], knR: [20, 0, 0] }],
        [0.38, { shR: [-95, 0, -20], elR: [-5, 0, 0], chest: [6, -40, 0], shL: [10, 0, 40], thL: [-30, 0, 0], knL: [20, 0, 0], thR: [15, 0, 0] }],
        [0.6, { shR: [-80, 0, 10], elR: [-10, 0, 0], chest: [6, -45, 0], shL: [10, 0, 40], thL: [-30, 0, 0], knL: [20, 0, 0], thR: [15, 0, 0] }],
        [0.85, { ...IDLE_BASE }],
      ],
      pos: [[0, [0, HIP_Y, 0]], [0.38, [0, HIP_Y - 0.08, 0.15]], [0.85, [0, HIP_Y, 0]]],
    },
    thrust: {
      dur: 0.85, loop: false, hit: 0.42,
      keys: [
        [0, { ...IDLE_BASE }],
        [0.25, { shR: [30, 0, -10], elR: [-100, 0, 0], shL: [-60, 0, 10], elL: [-40, 0, 0], chest: [0, 30, 0], thL: [-25, 0, 0], knR: [25, 0, 0] }],
        [0.42, { shR: [-95, 0, -5], elR: [0, 0, 0], shL: [-70, 0, 15], elL: [-10, 0, 0], chest: [10, -25, 0], thL: [-45, 0, 0], knL: [30, 0, 0], thR: [25, 0, 0] }],
        [0.62, { shR: [-90, 0, -5], elR: [-5, 0, 0], shL: [-60, 0, 15], chest: [8, -20, 0], thL: [-40, 0, 0], knL: [30, 0, 0], thR: [25, 0, 0] }],
        [0.85, { ...IDLE_BASE }],
      ],
      pos: [[0, [0, HIP_Y, 0]], [0.42, [0, HIP_Y - 0.1, 0.35]], [0.85, [0, HIP_Y, 0]]],
    },
    shoot: {
      dur: 0.9, loop: false, hit: 0.45,
      keys: [
        [0, { ...IDLE_BASE }],
        [0.25, { shR: [-88, 0, 4], elR: [-4, 0, 0], shL: [-82, 0, 26], elL: [-34, 0, 0], chest: [0, 18, 0], head: [0, 12, 0], thL: [-12, 0, 0], thR: [10, 0, 0] }],
        [0.45, { shR: [-100, 0, 4], elR: [-10, 0, 0], shL: [-90, 0, 26], elL: [-40, 0, 0], chest: [-8, 18, 0], head: [-4, 12, 0], thL: [-12, 0, 0], thR: [10, 0, 0] }],
        [0.62, { shR: [-88, 0, 4], elR: [-4, 0, 0], shL: [-82, 0, 26], elL: [-34, 0, 0], chest: [0, 18, 0], head: [0, 12, 0], thL: [-12, 0, 0], thR: [10, 0, 0] }],
        [0.9, { ...IDLE_BASE }],
      ],
    },
    rail: {
      dur: 1.2, loop: false, hit: 0.75,
      keys: [
        [0, { ...IDLE_BASE }],
        [0.35, { shR: [-90, 0, 4], elR: [-2, 0, 0], shL: [-86, 0, 28], elL: [-30, 0, 0], chest: [4, 22, 0], head: [6, 14, 0], thL: [-25, 0, 0], knL: [25, 0, 0], thR: [20, 0, 0], knR: [40, 0, 0] }],
        [0.7, { shR: [-90, 0, 4], elR: [-2, 0, 0], shL: [-86, 0, 28], elL: [-30, 0, 0], chest: [4, 22, 0], head: [6, 14, 0], thL: [-25, 0, 0], knL: [25, 0, 0], thR: [20, 0, 0], knR: [40, 0, 0] }],
        [0.8, { shR: [-110, 0, 4], elR: [-20, 0, 0], shL: [-100, 0, 28], elL: [-40, 0, 0], chest: [-14, 22, 0], head: [-6, 14, 0], thL: [-25, 0, 0], knL: [25, 0, 0], thR: [20, 0, 0], knR: [40, 0, 0] }],
        [1.2, { ...IDLE_BASE }],
      ],
      pos: [[0, [0, HIP_Y, 0]], [0.35, [0, HIP_Y - 0.1, 0]], [0.8, [0, HIP_Y - 0.1, -0.15]], [1.2, [0, HIP_Y, 0]]],
    },
    smash: {
      dur: 1.05, loop: false, hit: 0.6,
      keys: [
        [0, { ...IDLE_BASE }],
        [0.35, { shR: [-175, 0, -10], elR: [-30, 0, 0], shL: [-170, 0, 10], elL: [-30, 0, 0], chest: [-18, 0, 0], head: [-10, 0, 0], thL: [-10, 0, 0], thR: [10, 0, 0] }],
        [0.6, { shR: [-55, 0, -5], elR: [0, 0, 0], shL: [-55, 0, 5], elL: [0, 0, 0], chest: [32, 0, 0], head: [10, 0, 0], thL: [-35, 0, 0], knL: [45, 0, 0], thR: [25, 0, 0], knR: [50, 0, 0] }],
        [0.8, { shR: [-50, 0, -5], elR: [0, 0, 0], shL: [-50, 0, 5], chest: [30, 0, 0], thL: [-35, 0, 0], knL: [45, 0, 0], thR: [25, 0, 0], knR: [50, 0, 0] }],
        [1.05, { ...IDLE_BASE }],
      ],
      pos: [[0, [0, HIP_Y, 0]], [0.35, [0, HIP_Y + 0.25, 0]], [0.6, [0, HIP_Y - 0.22, 0.2]], [0.8, [0, HIP_Y - 0.2, 0.2]], [1.05, [0, HIP_Y, 0]]],
    },
    cleave: {
      dur: 1.0, loop: false, hit: 0.5,
      keys: [
        [0, { ...IDLE_BASE }],
        [0.3, { shR: [-140, 0, 40], elR: [-30, 0, 0], shL: [-130, 0, 20], elL: [-40, 0, 0], chest: [-8, 55, 0], thL: [-20, 0, 0], knR: [20, 0, 0] }],
        [0.5, { shR: [-80, 0, -60], elR: [-5, 0, 0], shL: [-70, 0, -10], elL: [-10, 0, 0], chest: [10, -60, 0], thL: [-35, 0, 0], knL: [30, 0, 0], thR: [20, 0, 0] }],
        [0.72, { shR: [-60, 0, -70], elR: [-5, 0, 0], shL: [-50, 0, -20], chest: [10, -70, 0], thL: [-35, 0, 0], knL: [30, 0, 0], thR: [20, 0, 0] }],
        [1.0, { ...IDLE_BASE }],
      ],
      pos: [[0, [0, HIP_Y, 0]], [0.5, [0, HIP_Y - 0.12, 0.2]], [1.0, [0, HIP_Y, 0]]],
    },
    dual: {
      dur: 1.0, loop: false, hits: [0.2, 0.38, 0.56, 0.74], hit: 0.2,
      keys: [
        [0, { ...IDLE_BASE }],
        [0.2, { shR: [-95, 0, -40], elR: [-10, 0, 0], shL: [-20, 0, 60], elL: [-60, 0, 0], chest: [6, -30, 0], thL: [-25, 0, 0], knL: [20, 0, 0] }],
        [0.38, { shL: [-95, 0, 40], elL: [-10, 0, 0], shR: [-20, 0, -60], elR: [-60, 0, 0], chest: [6, 30, 0], thL: [-25, 0, 0], knL: [20, 0, 0] }],
        [0.56, { shR: [-110, 0, -10], elR: [-10, 0, 0], shL: [-30, 0, 50], elL: [-50, 0, 0], chest: [10, -35, 0], thR: [-25, 0, 0], knR: [20, 0, 0] }],
        [0.74, { shL: [-110, 0, 10], elL: [-10, 0, 0], shR: [-30, 0, -50], elR: [-50, 0, 0], chest: [10, 35, 0], thR: [-25, 0, 0], knR: [20, 0, 0] }],
        [1.0, { ...IDLE_BASE }],
      ],
      pos: [[0, [0, HIP_Y, 0]], [0.38, [0, HIP_Y - 0.06, 0.12]], [0.74, [0, HIP_Y - 0.06, 0.12]], [1.0, [0, HIP_Y, 0]]],
    },
    reap: {
      dur: 1.05, loop: false, hit: 0.55,
      keys: [
        [0, { ...IDLE_BASE, hips: [0, 0, 0] }],
        [0.25, { hips: [0, 120, 0], shR: [-90, 0, -80], elR: [-10, 0, 0], shL: [-60, 0, 40], chest: [10, 20, 0], thL: [-20, 0, 0], knL: [20, 0, 0] }],
        [0.4, { hips: [0, 240, 0], shR: [-90, 0, -80], elR: [-10, 0, 0], shL: [-60, 0, 40], chest: [10, 20, 0], thL: [-20, 0, 0], knL: [20, 0, 0] }],
        [0.55, { hips: [0, 359, 0], shR: [-95, 0, -10], elR: [-5, 0, 0], shL: [-40, 0, 40], chest: [12, -30, 0], thL: [-30, 0, 0], knL: [25, 0, 0] }],
        [1.05, { ...IDLE_BASE, hips: [0, 360, 0] }],
      ],
      pos: [[0, [0, HIP_Y, 0]], [0.4, [0, HIP_Y + 0.15, 0.1]], [0.55, [0, HIP_Y - 0.08, 0.15]], [1.05, [0, HIP_Y, 0]]],
    },
  };
  const attackName = ({ katana: 'slash', dual: 'dual', rifle: 'shoot', railgun: 'rail', hammer: 'smash', greatsword: 'cleave', spear: 'thrust', scythe: 'reap' } as const)[cls];
  const attack = attacks[attackName];

  const cast: ClipDef = {
    dur: 1.0, loop: false, hit: 0.5,
    keys: [
      [0, { ...IDLE_BASE }],
      [0.3, { shL: [-60, 0, 30], elL: [-70, 0, 0], shR: [-60, 0, -30], elR: [-70, 0, 0], chest: [-6, 0, 0], head: [-6, 0, 0] }],
      [0.5, { shL: [-85, 0, -10], elL: [-5, 0, 0], shR: [-85, 0, 10], elR: [-5, 0, 0], chest: [8, 0, 0], thL: [-15, 0, 0], thR: [10, 0, 0] }],
      [0.75, { shL: [-80, 0, -10], elL: [-5, 0, 0], shR: [-80, 0, 10], elR: [-5, 0, 0], chest: [8, 0, 0], thL: [-15, 0, 0], thR: [10, 0, 0] }],
      [1.0, { ...IDLE_BASE }],
    ],
  };
  const buff: ClipDef = {
    dur: 0.9, loop: false, hit: 0.45,
    keys: [
      [0, { ...IDLE_BASE }],
      [0.45, { shL: [0, 0, 150], elL: [-20, 0, 0], shR: [0, 0, -150], elR: [-20, 0, 0], chest: [-12, 0, 0], head: [-15, 0, 0] }],
      [0.65, { shL: [0, 0, 145], elL: [-20, 0, 0], shR: [0, 0, -145], elR: [-20, 0, 0], chest: [-10, 0, 0], head: [-12, 0, 0] }],
      [0.9, { ...IDLE_BASE }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.45, [0, HIP_Y + 0.08, 0]], [0.9, [0, HIP_Y, 0]]],
  };
  const skill: ClipDef = {
    dur: 1.25, loop: false, hit: 0.85,
    keys: [
      [0, { ...IDLE_BASE, hips: [0, 0, 0] }],
      [0.25, { hips: [0, -120, 0], shR: [-150, 0, -40], elR: [-20, 0, 0], shL: [-40, 0, 60], thL: [-60, 0, 0], knL: [90, 0, 0], thR: [-30, 0, 0], knR: [70, 0, 0], chest: [-10, 0, 0] }],
      [0.5, { hips: [0, -240, 0], shR: [-170, 0, -20], elR: [-10, 0, 0], shL: [-40, 0, 60], thL: [-60, 0, 0], knL: [90, 0, 0], thR: [-30, 0, 0], knR: [70, 0, 0], chest: [-14, 0, 0] }],
      [0.85, { hips: [0, -360, 0], shR: [-70, 0, -10], elR: [0, 0, 0], shL: [0, 0, 50], thL: [-40, 0, 0], knL: [40, 0, 0], thR: [30, 0, 0], knR: [20, 0, 0], chest: [30, -20, 0] }],
      [1.0, { hips: [0, -360, 0], shR: [-60, 0, -10], elR: [0, 0, 0], shL: [0, 0, 50], thL: [-40, 0, 0], knL: [40, 0, 0], thR: [30, 0, 0], knR: [20, 0, 0], chest: [28, -20, 0] }],
      [1.25, { ...IDLE_BASE, hips: [0, -360, 0] }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.5, [0, HIP_Y + 0.9, 0.2]], [0.85, [0, HIP_Y - 0.18, 0.35]], [1.0, [0, HIP_Y - 0.18, 0.35]], [1.25, [0, HIP_Y, 0]]],
  };
  const ultimate: ClipDef = {
    dur: 2.1, loop: false, hit: 1.45,
    keys: [
      [0, { ...IDLE_BASE }],
      [0.4, { shL: [0, 0, 160], shR: [0, 0, -160], chest: [-20, 0, 0], head: [-25, 0, 0], thL: [-10, 0, 0], thR: [10, 0, 0] }],
      [0.8, { shL: [0, 0, 165], shR: [0, 0, -165], chest: [-22, 0, 0], head: [-28, 0, 0], thL: [-10, 0, 0], thR: [10, 0, 0] }],
      [1.1, { shR: [-175, 0, -5], elR: [-10, 0, 0], shL: [-170, 0, 5], elL: [-10, 0, 0], thL: [-70, 0, 0], knL: [100, 0, 0], thR: [-50, 0, 0], knR: [90, 0, 0], chest: [-10, 0, 0] }],
      [1.45, { shR: [-50, 0, -5], elR: [0, 0, 0], shL: [-50, 0, 5], chest: [35, 0, 0], head: [10, 0, 0], thL: [-40, 0, 0], knL: [60, 0, 0], thR: [30, 0, 0], knR: [60, 0, 0] }],
      [1.75, { shR: [-50, 0, -5], elR: [0, 0, 0], shL: [-50, 0, 5], chest: [30, 0, 0], thL: [-40, 0, 0], knL: [60, 0, 0], thR: [30, 0, 0], knR: [60, 0, 0] }],
      [2.1, { ...IDLE_BASE }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.8, [0, HIP_Y + 0.1, 0]], [1.1, [0, HIP_Y + 1.6, 0.3]], [1.45, [0, HIP_Y - 0.3, 0.6]], [1.75, [0, HIP_Y - 0.3, 0.6]], [2.1, [0, HIP_Y, 0]]],
  };
  const hit: ClipDef = {
    dur: 0.55, loop: false,
    keys: [
      [0, { ...IDLE_BASE }],
      [0.1, { chest: [-22, 8, 0], head: [-20, 0, 0], shL: [-30, 0, 40], elL: [-60, 0, 0], shR: [-30, 0, -40], elR: [-60, 0, 0], thL: [10, 0, 0], knL: [15, 0, 0] }],
      [0.55, { ...IDLE_BASE }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.1, [0, HIP_Y - 0.04, -0.18]], [0.55, [0, HIP_Y, 0]]],
  };
  const dodge: ClipDef = {
    dur: 0.65, loop: false,
    keys: [
      [0, { ...IDLE_BASE }],
      [0.25, { chest: [10, 0, 25], thL: [-40, 0, 20], knL: [60, 0, 0], thR: [-20, 0, -10], knR: [40, 0, 0], shL: [0, 0, 60], shR: [0, 0, -40] }],
      [0.65, { ...IDLE_BASE }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.25, [-0.9, HIP_Y + 0.3, -0.2]], [0.45, [-0.6, HIP_Y - 0.05, -0.1]], [0.65, [0, HIP_Y, 0]]],
  };
  const defend: ClipDef = {
    dur: 0.8, loop: false, hit: 0.3,
    keys: [
      [0, { ...IDLE_BASE }],
      [0.3, { shL: [-80, 0, -30], elL: [-110, 0, 0], shR: [-80, 0, 30], elR: [-110, 0, 0], chest: [10, 0, 0], head: [10, 0, 0], thL: [-25, 0, 0], knL: [35, 0, 0], thR: [15, 0, 0], knR: [35, 0, 0] }],
      [0.8, { shL: [-78, 0, -30], elL: [-110, 0, 0], shR: [-78, 0, 30], elR: [-110, 0, 0], chest: [10, 0, 0], head: [10, 0, 0], thL: [-25, 0, 0], knL: [35, 0, 0], thR: [15, 0, 0], knR: [35, 0, 0] }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.3, [0, HIP_Y - 0.1, 0]], [0.8, [0, HIP_Y - 0.1, 0]]],
  };
  const victory: ClipDef = {
    dur: 1.4, loop: false,
    keys: [
      [0, { ...IDLE_BASE }],
      [0.35, { shR: [0, 0, -175], elR: [-10, 0, 0], shL: [10, 0, 30], elL: [-80, 0, 0], chest: [-8, 0, 0], head: [-15, 10, 0], thL: [-15, 0, 0], knL: [20, 0, 0] }],
      [1.4, { shR: [0, 0, -172], elR: [-15, 0, 0], shL: [10, 0, 30], elL: [-80, 0, 0], chest: [-6, 0, 0], head: [-12, 10, 0], thL: [-15, 0, 0], knL: [20, 0, 0] }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.2, [0, HIP_Y + 0.35, 0]], [0.35, [0, HIP_Y, 0]], [1.4, [0, HIP_Y, 0]]],
  };
  const defeat: ClipDef = {
    dur: 1.1, loop: false,
    keys: [
      [0, { ...IDLE_BASE }],
      [0.4, { chest: [-20, 0, 0], head: [-25, 0, 0], thL: [-30, 0, 0], knL: [60, 0, 0], thR: [-20, 0, 0], knR: [50, 0, 0], shL: [-20, 0, 30], shR: [-20, 0, -30] }],
      [1.1, { chest: [40, 0, 10], head: [35, 0, 0], thL: [-80, 0, 0], knL: [130, 0, 0], thR: [-60, 0, 0], knR: [140, 0, 0], shL: [10, 0, 20], elL: [-20, 0, 0], shR: [10, 0, -20], elR: [-20, 0, 0] }],
    ],
    pos: [[0, [0, HIP_Y, 0]], [0.4, [0, HIP_Y - 0.15, -0.1]], [1.1, [0, 0.42, 0.05]]],
  };
  const combo: ClipDef = { ...skill };
  return { idle, walk, run, attack, skill, ultimate, cast, buff, hit, dodge, defend, victory, defeat, combo, ...(ranged ? {} : {}) };
}

function buildClip(name: string, def: ClipDef): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const used = new Set<string>();
  for (const [, p] of def.keys) Object.keys(p).forEach((k) => used.add(k));
  for (const j of used) {
    const times: number[] = [];
    const values: number[] = [];
    let last: V3 = [0, 0, 0];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let prevQ: THREE.Quaternion | null = null;
    for (const [t, p] of def.keys) {
      const v = p[j] ?? (JOINTS.includes(j) && !(j in p) ? [0, 0, 0] : last);
      last = v as V3;
      e.set(v[0] * D, v[1] * D, v[2] * D, 'XYZ');
      q.setFromEuler(e);
      // keep quaternion hemisphere continuous for spins
      if (prevQ && prevQ.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      prevQ = q.clone();
      times.push(t);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${j}.quaternion`, times, values));
  }
  if (def.pos) {
    tracks.push(new THREE.VectorKeyframeTrack('hips.position', def.pos.map((p) => p[0]), def.pos.flatMap((p) => p[1])));
  } else {
    tracks.push(new THREE.VectorKeyframeTrack('hips.position', [0, def.dur], [0, HIP_Y, 0, 0, HIP_Y, 0]));
  }
  return new THREE.AnimationClip(name, def.dur, tracks);
}

const clipCache = new Map<string, { clips: Record<string, THREE.AnimationClip>; defs: Record<string, ClipDef> }>();
function getClips(cls: WeaponClass) {
  let c = clipCache.get(cls);
  if (!c) {
    const defs = clipsFor(cls);
    const clips: Record<string, THREE.AnimationClip> = {};
    for (const [k, d] of Object.entries(defs)) clips[k] = buildClip(k, d);
    c = { clips, defs };
    clipCache.set(cls, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// model building
// ---------------------------------------------------------------------------

function joint(name: string, parent: THREE.Object3D, x: number, y: number, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function buildWeapon(weaponId: string): THREE.Group {
  const w = WEAPON_MAP[weaponId] ?? WEAPON_MAP.energy_katana;
  const g = new THREE.Group();
  g.name = 'weapon';
  const c = w.color;
  const metal = toon('#3b4256');
  const dark = toon('#1b1f2c');
  const blade = glow(c);
  switch (w.cls) {
    case 'katana': {
      const grip = part(cyl(0.025, 0.025, 0.22, 8), dark);
      grip.rotation.x = Math.PI / 2;
      grip.position.z = 0.02;
      const guard = part(box(0.12, 0.02, 0.04), metal);
      guard.position.z = 0.13;
      const b = part(box(0.025, 0.06, 0.95), blade, { outline: 0.012 });
      b.position.z = 0.62;
      g.add(grip, guard, b);
      break;
    }
    case 'dual': {
      const grip = part(cyl(0.025, 0.025, 0.14, 8), dark);
      grip.rotation.x = Math.PI / 2;
      const b = part(box(0.02, 0.07, 0.55), blade, { outline: 0.012 });
      b.position.z = 0.36;
      g.add(grip, b);
      break;
    }
    case 'rifle':
    case 'railgun': {
      const long = w.cls === 'railgun';
      const body = part(box(0.09, 0.12, long ? 0.95 : 0.7), metal);
      body.position.set(0, -0.02, -0.15);
      const barrel = part(cyl(0.025, 0.03, long ? 0.6 : 0.4, 8), dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.01, long ? -0.85 : -0.68);
      const glowStrip = part(box(0.1, 0.025, long ? 0.8 : 0.5), blade, { outline: false });
      glowStrip.position.set(0, 0.06, -0.15);
      const muzzle = part(sphere(0.04, 8, 6), blade, { outline: false });
      muzzle.position.set(0, 0.01, long ? -1.15 : -0.9);
      muzzle.name = 'muzzle';
      g.add(body, barrel, glowStrip, muzzle);
      if (long) {
        const rails = part(box(0.14, 0.02, 0.7), blade, { outline: false });
        rails.position.set(0, -0.05, -0.55);
        g.add(rails);
      }
      // rifles point along the arm (-Y); rotate so -Z aligns with -Y
      g.rotation.x = -Math.PI / 2;
      g.position.set(0, -0.05, 0.05);
      break;
    }
    case 'hammer': {
      const h = part(cyl(0.03, 0.03, 0.9, 8), dark);
      h.rotation.x = Math.PI / 2;
      h.position.z = 0.3;
      const head = part(box(0.32, 0.22, 0.22), metal);
      head.position.z = 0.78;
      const core = part(sphere(0.09, 12, 8), blade, { outline: false });
      core.position.set(0, 0.12, 0.78);
      const ring = part(torus(0.16, 0.02), blade, { outline: false });
      ring.position.z = 0.78;
      g.add(h, head, core, ring);
      break;
    }
    case 'greatsword': {
      const grip = part(cyl(0.03, 0.03, 0.3, 8), dark);
      grip.rotation.x = Math.PI / 2;
      const guard = part(box(0.26, 0.05, 0.06), metal);
      guard.position.z = 0.17;
      const b = part(box(0.05, 0.2, 1.3), metal);
      b.position.z = 0.85;
      const edge = part(box(0.06, 0.06, 1.3), blade, { outline: false });
      edge.position.set(0, 0.11, 0.85);
      g.add(grip, guard, b, edge);
      break;
    }
    case 'spear': {
      const shaft = part(cyl(0.022, 0.022, 1.7, 8), dark);
      shaft.position.y = -0.2;
      const tip = part(cone(0.06, 0.32, 6), blade, { outline: 0.012 });
      tip.position.y = -1.2;
      tip.rotation.x = Math.PI;
      const ring = part(torus(0.07, 0.015), blade, { outline: false });
      ring.position.y = -0.95;
      ring.rotation.x = Math.PI / 2;
      g.add(shaft, tip, ring);
      g.position.y = 0.3;
      break;
    }
    case 'scythe': {
      const shaft = part(cyl(0.022, 0.022, 1.6, 8), dark);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.45;
      const bladeG = new THREE.Group();
      const arcGeo = geo('scythe_arc', () => new THREE.TorusGeometry(0.45, 0.045, 6, 20, Math.PI * 0.75));
      const arc = new THREE.Mesh(arcGeo, blade);
      arc.scale.set(1, 1, 0.4);
      bladeG.add(arc);
      bladeG.position.set(0, -0.2, 1.2);
      bladeG.rotation.set(0, Math.PI / 2, Math.PI * 0.15);
      const head = part(box(0.08, 0.12, 0.14), metal);
      head.position.z = 1.22;
      g.add(shaft, bladeG, head);
      break;
    }
  }
  g.userData.color = c;
  return g;
}

export interface CharacterOptions {
  look: Appearance;
  weaponId: string;
  scale?: number;
}

export class CharacterModel {
  readonly root = new THREE.Group();
  readonly mixer: THREE.AnimationMixer;
  readonly joints: Record<string, THREE.Object3D> = {};
  private actions: Record<string, THREE.AnimationAction> = {};
  private defs: Record<string, ClipDef> = {};
  private current = 'idle';
  private oneShotTimer = 0;
  weaponCls: WeaponClass;
  weaponColor: string;
  private weaponR: THREE.Group | null = null;
  private weaponL: THREE.Group | null = null;
  ranged: boolean;

  constructor(readonly opts: CharacterOptions) {
    const w = WEAPON_MAP[opts.weaponId] ?? WEAPON_MAP.energy_katana;
    this.weaponCls = w.cls;
    this.weaponColor = w.color;
    this.ranged = w.ranged;
    this.build();
    this.root.scale.setScalar(opts.scale ?? 0.9);
    this.mixer = new THREE.AnimationMixer(this.root);
    const { clips, defs } = getClips(w.cls);
    this.defs = defs;
    for (const [k, c] of Object.entries(clips)) {
      const a = this.mixer.clipAction(c);
      if (!defs[k].loop) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[k] = a;
    }
    this.actions.idle.play();
  }

  private build() {
    const L = this.opts.look;
    const sturdy = L.body === 1;
    const skin = toon(L.skin);
    const cloth = toon(L.outfitColor);
    const cloth2 = toon(new THREE.Color(L.outfitColor).multiplyScalar(0.6));
    const accent = glow(L.accentColor);
    const hair = toon(L.hairColor);
    const bw = sturdy ? 1.18 : 1;

    const hips = joint('hips', this.root, 0, HIP_Y);
    this.joints.hips = hips;
    const pelvis = part(box(0.3 * bw, 0.16, 0.18), cloth2);
    hips.add(pelvis);
    const spine = joint('spine', hips, 0, 0.08);
    const chest = joint('chest', spine, 0, 0.12);
    const torso = part(capsule(0.15 * bw, 0.2), cloth);
    torso.scale.set(1.05, 1, 0.75);
    torso.position.y = 0.12;
    chest.add(torso);
    // outfit details
    const collar = part(cyl(0.1, 0.13, 0.06, 10), cloth2);
    collar.position.y = 0.33;
    chest.add(collar);
    const stripe = part(box(0.04, 0.3, 0.02), accent, { outline: false });
    stripe.position.set(0.06, 0.12, 0.12);
    chest.add(stripe);
    const belt = part(box(0.32 * bw, 0.05, 0.2), toon('#1a1d29'));
    belt.position.y = 0.06;
    hips.add(belt);
    const buckle = part(box(0.06, 0.04, 0.02), accent, { outline: false });
    buckle.position.set(0, 0.06, 0.105);
    hips.add(buckle);
    if (L.outfit === 1 || L.outfit === 3) {
      // coat tails / skirt
      const tail = part(cyl(0.17 * bw, 0.26 * bw, 0.32, 10), cloth);
      tail.position.y = -0.12;
      hips.add(tail);
    }
    if (L.outfit === 2) {
      const pad = part(sphere(0.08, 10, 8), cloth2);
      pad.position.set(0.19 * bw, 0.27, 0);
      const pad2 = pad.clone();
      pad2.position.x = -0.19 * bw;
      chest.add(pad, pad2);
    }
    if (L.outfit === 3) {
      const plate = part(box(0.3 * bw, 0.18, 0.08), toon('#5a6070'));
      plate.position.set(0, 0.18, 0.1);
      chest.add(plate);
    }
    // scarf / tech pack
    const pack = part(box(0.22, 0.24, 0.1), cloth2);
    pack.position.set(0, 0.14, -0.14);
    chest.add(pack);
    const packGlow = part(box(0.14, 0.03, 0.02), accent, { outline: false });
    packGlow.position.set(0, 0.2, -0.195);
    chest.add(packGlow);

    const neck = joint('neck', chest, 0, 0.32);
    const neckMesh = part(cyl(0.045, 0.05, 0.08, 8), skin);
    neck.add(neckMesh);
    const head = joint('head', neck, 0, 0.06);
    this.joints.head = head;
    const skull = part(sphere(0.2, 20, 16), skin);
    skull.scale.set(1, 1.05, 0.98);
    skull.position.y = 0.17;
    head.add(skull);
    // face
    const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTexture(L.eyeColor), transparent: true, toneMapped: false });
    eyeMat.userData.shared = false;
    const eyeGeo = new THREE.PlaneGeometry(0.1, 0.12);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(0.075, 0.14, 0.192);
    eyeL.rotation.y = 0.28;
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(-0.075, 0.14, 0.192);
    eyeR.rotation.y = -0.28;
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshBasicMaterial({ map: mouthTexture(), transparent: true }));
    mouth.position.set(0, 0.055, 0.178);
    const blushMat = glow('#ff8fa8', 0.35);
    const blushL = new THREE.Mesh(sphere(0.022, 8, 6), blushMat);
    blushL.scale.set(1.4, 0.6, 0.3);
    blushL.position.set(0.11, 0.095, 0.17);
    const blushR = blushL.clone();
    blushR.position.x = -0.11;
    head.add(eyeL, eyeR, mouth, blushL, blushR);
    this.buildHair(head, hair, L.hair);
    this.buildAccessory(head, L.accessory, accent);

    // arms
    const armR = 0.055 * (sturdy ? 1.15 : 1);
    const mkArm = (side: 1 | -1) => {
      const n = side === 1 ? 'L' : 'R';
      const sh = joint(`sh${n}`, chest, side * 0.2 * bw, 0.27);
      const up = part(capsule(armR, 0.16), cloth);
      up.position.y = -0.13;
      sh.add(up);
      const shoulder = part(sphere(armR * 1.35, 10, 8), cloth2);
      sh.add(shoulder);
      const el = joint(`el${n}`, sh, 0, -0.28);
      const fore = part(capsule(armR * 0.9, 0.15), skin);
      fore.position.y = -0.12;
      el.add(fore);
      const cuff = part(cyl(armR * 1.1, armR * 1.1, 0.06, 8), accent, { outline: false });
      cuff.position.y = -0.17;
      el.add(cuff);
      const hand = joint(`hand${n}`, el, 0, -0.27);
      const handMesh = part(sphere(armR * 1.05, 10, 8), skin);
      hand.add(handMesh);
      this.joints[`sh${n}`] = sh;
      this.joints[`hand${n}`] = hand;
      return hand;
    };
    const handL = mkArm(1);
    const handR = mkArm(-1);
    // legs
    const legR = 0.07 * (sturdy ? 1.15 : 1);
    const mkLeg = (side: 1 | -1) => {
      const n = side === 1 ? 'L' : 'R';
      const th = joint(`th${n}`, hips, side * 0.095 * bw, -0.04);
      const thigh = part(capsule(legR, 0.24), cloth2);
      thigh.position.y = -0.2;
      th.add(thigh);
      const kn = joint(`kn${n}`, th, 0, -0.42);
      const shin = part(capsule(legR * 0.85, 0.24), cloth2);
      shin.position.y = -0.18;
      kn.add(shin);
      const boot = part(box(0.11, 0.1, 0.2), toon('#20232f'));
      boot.position.set(0, -0.38, 0.03);
      kn.add(boot);
      const bootGlow = part(box(0.115, 0.02, 0.05), accent, { outline: false });
      bootGlow.position.set(0, -0.34, 0.1);
      kn.add(bootGlow);
    };
    mkLeg(1);
    mkLeg(-1);

    // weapon
    this.weaponR = buildWeapon(this.opts.weaponId);
    handR.add(this.weaponR);
    if (this.weaponCls === 'dual') {
      this.weaponL = buildWeapon(this.opts.weaponId);
      handL.add(this.weaponL);
    }
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== 'outline') o.castShadow = true;
    });
  }

  private buildHair(head: THREE.Object3D, mat: THREE.Material, style: number) {
    // top cap (upper part of a sphere) + back of head, leaving the face visible
    const capGeo = geo('hair_cap', () => new THREE.SphereGeometry(0.218, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42));
    const cap = part(capGeo, mat, { outline: 0.015 });
    cap.scale.set(1.05, 1.05, 1.08);
    cap.position.set(0, 0.17, -0.01);
    head.add(cap);
    const backHair = part(sphere(0.205, 16, 12), mat);
    backHair.scale.set(1.04, 1.02, 0.9);
    backHair.position.set(0, 0.16, -0.06);
    head.add(backHair);
    const bang = (x: number, rotZ: number, len = 0.16, r = 0.05) => {
      const b = part(cone(r, len, 6), mat, { outline: 0.012 });
      b.position.set(x, 0.27, 0.165);
      b.rotation.set(Math.PI + 0.5, 0, rotZ);
      head.add(b);
    };
    // fringe common to all
    [-0.1, -0.035, 0.035, 0.1].forEach((x, i) => bang(x, (i - 1.5) * 0.25));
    switch (style % 6) {
      case 0: // spiky
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const s = part(cone(0.06, 0.22, 6), mat, { outline: 0.012 });
          s.position.set(Math.sin(a) * 0.15, 0.3, Math.cos(a) * 0.12 - 0.04);
          s.rotation.set(-Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
          head.add(s);
        }
        break;
      case 1: { // short undercut
        const top = part(box(0.3, 0.1, 0.34), mat);
        top.position.set(0, 0.36, -0.02);
        head.add(top);
        break;
      }
      case 2: { // long straight
        const back = part(box(0.38, 0.5, 0.12), mat);
        back.position.set(0, 0.05, -0.17);
        head.add(back);
        const sideL = part(box(0.06, 0.34, 0.14), mat);
        sideL.position.set(0.19, 0.08, 0.04);
        const sideR = sideL.clone();
        sideR.position.x = -0.19;
        head.add(sideL, sideR);
        break;
      }
      case 3: { // bob
        const bob = part(sphere(0.235, 18, 12), mat);
        bob.scale.set(1.02, 0.85, 1.02);
        bob.position.set(0, 0.12, -0.03);
        head.add(bob);
        break;
      }
      case 4: { // twin tails
        for (const s of [1, -1]) {
          const knot = part(sphere(0.06, 10, 8), mat);
          knot.position.set(s * 0.2, 0.28, -0.08);
          const tail = part(cone(0.08, 0.5, 8), mat);
          tail.position.set(s * 0.26, 0.02, -0.12);
          tail.rotation.set(Math.PI, 0, -s * 0.25);
          head.add(knot, tail);
        }
        break;
      }
      case 5: { // ponytail
        const knot = part(sphere(0.06, 10, 8), mat);
        knot.position.set(0, 0.3, -0.2);
        const tail = part(cone(0.085, 0.55, 8), mat);
        tail.position.set(0, 0.02, -0.28);
        tail.rotation.set(Math.PI + 0.3, 0, 0);
        head.add(knot, tail);
        break;
      }
    }
  }

  private buildAccessory(head: THREE.Object3D, kind: number, accent: THREE.Material) {
    if (kind === 1) {
      const visor = new THREE.Mesh(box(0.34, 0.06, 0.08), glow(this.opts.look.accentColor, 0.7, true));
      visor.position.set(0, 0.16, 0.17);
      head.add(visor);
    } else if (kind === 2) {
      const band = part(torus(0.22, 0.018), toon('#22263a'));
      band.position.y = 0.2;
      band.rotation.y = Math.PI / 2;
      head.add(band);
      for (const s of [1, -1]) {
        const cup = part(cyl(0.065, 0.065, 0.05, 12), toon('#22263a'));
        cup.rotation.z = Math.PI / 2;
        cup.position.set(s * 0.215, 0.14, 0);
        const ring = part(torus(0.05, 0.012), accent, { outline: false });
        ring.rotation.y = Math.PI / 2;
        ring.position.set(s * 0.245, 0.14, 0);
        head.add(cup, ring);
      }
    } else if (kind === 3) {
      for (const s of [1, -1]) {
        const ear = part(cone(0.05, 0.12, 4), toon(this.opts.look.hairColor));
        ear.position.set(s * 0.12, 0.42, -0.02);
        ear.rotation.z = -s * 0.3;
        const tip = new THREE.Mesh(sphere(0.018, 6, 4), accent);
        tip.position.set(s * 0.14, 0.48, -0.02);
        head.add(ear, tip);
      }
    }
  }

  /** start a looping locomotion clip */
  setLoop(name: 'idle' | 'walk' | 'run', fade = 0.18) {
    if (this.oneShotTimer > 0 || this.current === name) return;
    const next = this.actions[name];
    const prev = this.actions[this.current];
    next.reset().play();
    if (prev && prev !== next) prev.crossFadeTo(next, fade, false);
    this.current = name;
  }

  /** play a one-shot clip; resolves with impact time(s) (seconds after start) */
  play(name: string, opts: { fade?: number; hold?: boolean; speed?: number } = {}): { duration: number; hit: number; hits: number[] } {
    const a = this.actions[name] ?? this.actions.attack;
    const def = this.defs[name] ?? this.defs.attack;
    const prev = this.actions[this.current];
    a.reset();
    a.timeScale = opts.speed ?? 1;
    a.setEffectiveWeight(1);
    a.play();
    if (prev && prev !== a) prev.crossFadeTo(a, opts.fade ?? 0.1, false);
    this.current = name;
    const sp = opts.speed ?? 1;
    this.oneShotTimer = opts.hold ? Infinity : def.dur / sp;
    return { duration: def.dur / sp, hit: (def.hit ?? def.dur * 0.5) / sp, hits: (def.hits ?? [def.hit ?? def.dur * 0.5]).map((h) => h / sp) };
  }

  /** release a held pose (e.g. after defend / defeat) */
  release() {
    this.oneShotTimer = 0;
    const idle = this.actions.idle;
    const prev = this.actions[this.current];
    idle.reset().play();
    if (prev && prev !== idle) prev.crossFadeTo(idle, 0.25, false);
    this.current = 'idle';
  }

  update(dt: number) {
    this.mixer.update(dt);
    if (this.oneShotTimer !== Infinity && this.oneShotTimer > 0) {
      this.oneShotTimer -= dt;
      if (this.oneShotTimer <= 0) {
        this.oneShotTimer = 0;
        this.release();
      }
    }
  }

  get busy() {
    return this.oneShotTimer > 0;
  }

  /** world position of the weapon tip-ish (for VFX) */
  weaponPoint(out = new THREE.Vector3()): THREE.Vector3 {
    const muzzle = this.weaponR?.getObjectByName('muzzle');
    (muzzle ?? this.weaponR ?? this.root).getWorldPosition(out);
    return out;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}

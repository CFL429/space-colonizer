import * as THREE from 'three'

/**
 * Meteor strikes: an ember-cored rock dropped onto a building from an angle, for the
 * "destroy" action. Rare and only ever a few in flight at once, so this is a small pool of
 * plain meshes rather than anything instanced — the crew and the buildings are where the
 * draw-call budget goes.
 *
 * Each strike is a `carrier` group aimed at the target once, at spawn, and never rotated
 * again — the fall is a straight line, so the direction back to `from` never changes and the
 * trail can be static. The rock tumbles on its own inside the carrier instead, so it visibly
 * spins without dragging the trail around with it.
 */

const FALL_HEIGHT = 15
const FALL_TIME = 0.85
const ROCK_COLOR = 0x3a332c
const GLOW_COLOR = 0xff7a33

export class Meteors {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'meteors'
    scene.add(this.group)
    this.active = []

    this._rockGeo = new THREE.IcosahedronGeometry(0.42, 0)
    this._rockMat = new THREE.MeshStandardMaterial({
      color: ROCK_COLOR,
      roughness: 0.92,
      metalness: 0,
      emissive: new THREE.Color(GLOW_COLOR),
      emissiveIntensity: 1.6,
    })

    // A hollow cone with its apex pinned to the carrier's origin and its base flared out
    // along local +Z — which, once the carrier is aimed at the target, is back the way the
    // rock came from. The material is cloned per strike so two meteors in flight don't fight
    // over one shared opacity.
    this._trailGeo = new THREE.ConeGeometry(0.15, 1.7, 6, 1, true)
    this._trailGeo.translate(0, -0.85, 0)
    this._trailGeo.rotateX(-Math.PI / 2)
    this._trailMat = new THREE.MeshBasicMaterial({
      color: GLOW_COLOR,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  }

  /** Drop one onto `target` (a world position) — `onImpact` fires once it lands there. */
  strike(target, onImpact) {
    const carrier = new THREE.Group()
    const rock = new THREE.Mesh(this._rockGeo, this._rockMat)
    const trailMat = this._trailMat.clone()
    const trail = new THREE.Mesh(this._trailGeo, trailMat)
    carrier.add(rock, trail)
    this.group.add(carrier)

    // In from a random side rather than straight down — a vertical drop reads as an
    // elevator, not an impact.
    const a = Math.random() * Math.PI * 2
    const from = new THREE.Vector3(
      target.x + Math.cos(a) * FALL_HEIGHT * 0.55,
      target.y + FALL_HEIGHT,
      target.z + Math.sin(a) * FALL_HEIGHT * 0.55
    )
    carrier.position.copy(from)
    carrier.lookAt(target)

    this.active.push({
      carrier,
      rock,
      trailMat,
      from,
      to: target.clone(),
      t: 0,
      onImpact,
      spin: 2 + Math.random() * 4,
      spinAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    })
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i]
      m.t += dt / FALL_TIME
      const t = Math.min(1, m.t)
      // Accelerating, like gravity — a linear fall reads as a lift descending.
      const eased = t * t
      m.carrier.position.lerpVectors(m.from, m.to, eased)
      m.rock.rotateOnAxis(m.spinAxis, dt * m.spin)
      // The trail grows in as the rock picks up speed.
      m.trailMat.opacity = 0.12 + eased * 0.45

      if (t >= 1) {
        this.group.remove(m.carrier)
        m.trailMat.dispose()
        m.onImpact?.()
        this.active.splice(i, 1)
      }
    }
  }

  dispose() {
    for (const m of this.active) {
      this.group.remove(m.carrier)
      m.trailMat.dispose()
    }
    this.active.length = 0
    this._rockGeo.dispose()
    this._rockMat.dispose()
    this._trailGeo.dispose()
    this._trailMat.dispose()
    this.scene.remove(this.group)
  }
}

import * as THREE from 'three'

/**
 * "+1.2K" popups over an astronaut's head — the currency's whole visible feedback loop.
 * Fired once per poll for whichever threads spent tokens since the last one, each a tiny
 * canvas-texture billboard (the amount is arbitrary text, so this can't be instanced the
 * way the crew's own worn parts are) drifting up and fading over its short life.
 */

const RISE = 1.1
const LIFE = 1.8

/**
 * Where the status badge's own bottom edge and screen-space size live, in `agents/indicators.js`
 * — a payout has to clear the badge at whatever zoom the badge happens to be drawn at, not just
 * at the distance someone tested it at. A badge holds a near-constant *screen* size, so its
 * world-space height grows with camera distance; mirroring that formula here (with the bigger
 * "urgent" badge size, since a payout can land on any status) is what keeps the popup above it
 * whether the camera is pulled in close or right out.
 */
const BADGE_HEAD_CLEAR = 1.42
const BADGE_URGENT_SIZE = 0.166
const CLEARANCE = 0.3

const FORMAT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
/** Compact like the wallet's own readout — a raw token count is not a headline. */
export const formatTokens = (n) => FORMAT.format(n)

export class PayPopups {
  constructor(scene, camera) {
    this.scene = scene
    this.camera = camera
    this.group = new THREE.Group()
    this.group.name = 'pay-popups'
    scene.add(this.group)
    this.active = []
    this._view = new THREE.Vector3()
  }

  /** `worldPos` is read once, at spawn — the popup does not track a moving astronaut. */
  spawn(worldPos, amount) {
    // A burst of polls landing at once should not turn into a runaway mesh count.
    if (this.active.length > 24) return
    const mesh = buildPopup(`+${formatTokens(amount)}`)
    const dist = -this._view.copy(worldPos).applyMatrix4(this.camera.matrixWorldInverse).z
    const badgeTop = BADGE_HEAD_CLEAR + BADGE_URGENT_SIZE * (2.0 + Math.max(0, dist) * 0.22)
    mesh.position.set(worldPos.x, worldPos.y + badgeTop + CLEARANCE, worldPos.z)
    this.group.add(mesh)
    this.active.push({ mesh, t: 0, baseY: mesh.position.y })
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]
      p.t += dt
      const t = Math.min(1, p.t / LIFE)
      p.mesh.position.y = p.baseY + RISE * (1 - (1 - t) * (1 - t))
      p.mesh.material.opacity = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85

      if (t >= 1) {
        this.group.remove(p.mesh)
        disposePopup(p.mesh)
        this.active.splice(i, 1)
      }
    }
  }

  dispose() {
    for (const p of this.active) {
      this.group.remove(p.mesh)
      disposePopup(p.mesh)
    }
    this.active.length = 0
    this.scene.remove(this.group)
  }
}

function disposePopup(mesh) {
  mesh.material.map.dispose()
  mesh.geometry.dispose()
  mesh.material.dispose()
}

/** A gold, drop-shadowed label on a billboard that holds a near-constant screen size —
 *  the same trick the zone name plates use, in `world/plots.js`. */
function buildPopup(label) {
  const fontSize = 40
  const font = `800 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`
  const pixelRatio = 3
  const pad = 10

  const measure = document.createElement('canvas').getContext('2d')
  measure.font = font
  const textWidth = Math.ceil(measure.measureText(label).width)

  const w = textWidth + pad * 2
  const h = fontSize + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w * pixelRatio)
  canvas.height = Math.ceil(h * pixelRatio)
  const c = canvas.getContext('2d')
  c.scale(pixelRatio, pixelRatio)
  c.font = font
  c.textAlign = 'left'
  c.textBaseline = 'middle'

  c.shadowColor = 'rgba(0,0,0,0.85)'
  c.shadowBlur = 8
  c.fillStyle = 'rgba(0,0,0,0.9)'
  for (let i = 0; i < 3; i++) c.fillText(label, pad, h / 2)
  c.shadowBlur = 0
  c.fillStyle = '#ffd76a'
  c.fillText(label, pad, h / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4

  const height = 0.62
  const geo = new THREE.PlaneGeometry(height * (w / h), height)
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    opacity: 0,
  })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
       float dist = -mvPosition.z;
       mvPosition.xy += position.xy * ( 0.5 + dist * 0.025 );
       gl_Position = projectionMatrix * mvPosition;`
    )
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = 9
  mesh.frustumCulled = false
  return mesh
}

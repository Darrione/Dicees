import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as CANNON from 'cannon-es';
import {
  CameraViewId,
  GemstonePresetId,
  IndividualDieResult,
} from '../types/dice';
import { GEMSTONE_MATERIALS } from '../constants/gemstones';
import {
  buildGemstoneDie,
  DieFaceDescriptor,
  getTopFaceValue,
} from '../utils/diceGeometry';
import {
  createWalnutTableTextures,
  getDieFaceNumeralTexture,
} from '../utils/textures';
import { diceAudio } from '../utils/audio';

interface ActiveDieEntity {
  id: number;
  sides: number;
  gemstone: GemstonePresetId;
  group: THREE.Group;
  body: CANNON.Body;
  faces: DieFaceDescriptor[];
  shadowMesh: THREE.Mesh;
  badgeSprite: THREE.Sprite;
  settled: boolean;
  settledFrames: number;
  finalValue: number;
}

interface DiceArenaCanvasProps {
  rollTrigger: number;
  diceCount: number;
  sides: number;
  gemstone: GemstonePresetId;
  cameraView: CameraViewId;
  onRollStart: () => void;
  onRollComplete: (results: IndividualDieResult[]) => void;
}

// Pre-allocated math helpers at module scope to guarantee Zero GC inside tick()
const _vec3 = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0, 0);
const _upVec = new THREE.Vector3(0, 1, 0);
const _alignQuat = new THREE.Quaternion();
const _worldFaceNormal = new THREE.Vector3();

const CAMERA_PRESETS: Record<CameraViewId, { pos: [number, number, number]; target: [number, number, number] }> = {
  tavern: { pos: [0, 14.5, 11.5], target: [0, 0, 0.4] },
  overhead: { pos: [0, 19.5, 0.01], target: [0, 0, 0] },
  closeup: { pos: [0, 9.2, 7.8], target: [0, 0.3, 0] },
};

/**
 * Creates a soft radial contact shadow texture once
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(5, 2, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(5, 2, 0, 0.28)');
  grad.addColorStop(1, 'rgba(5, 2, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a floating crystal value badge sprite for settled dice
 */
function createValueBadgeMaterial(
  value: number,
  inlayColor: string,
  isCrit: boolean,
  isFumble: boolean,
  maxAnisotropy: number
): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const cx = 64;
  const cy = 64;

  // Obsidian medallion backing
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fillStyle = isCrit
    ? 'rgba(180, 83, 9, 0.92)'
    : isFumble
    ? 'rgba(127, 29, 29, 0.92)'
    : 'rgba(16, 12, 9, 0.88)';
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = isCrit ? '#fde047' : isFumble ? '#f87171' : inlayColor;
  ctx.stroke();

  ctx.font = '700 48px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isCrit ? '#fef08a' : '#f8fafc';
  ctx.fillText(String(value), cx, cy + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;

  return new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

export const DiceArenaCanvas: React.FC<DiceArenaCanvasProps> = ({
  rollTrigger,
  diceCount,
  sides,
  gemstone,
  cameraView,
  onRollStart,
  onRollComplete,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);

  // Store latest props and callbacks in refs so React updates never tear down the WebGL context
  const callbacksRef = useRef({ onRollStart, onRollComplete });
  callbacksRef.current = { onRollStart, onRollComplete };

  const configRef = useRef({ diceCount, sides, gemstone });
  configRef.current = { diceCount, sides, gemstone };

  const cameraPresetRef = useRef<CameraViewId>(cameraView);
  const cameraTransitionActiveRef = useRef<boolean>(false);

  const spawnRollFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cameraPresetRef.current = cameraView;
    cameraTransitionActiveRef.current = true;
  }, [cameraView]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Horizon Fog & Studio Environment Reflection
    const scene = new THREE.Scene();
    const bgColor = new THREE.Color('#0e0b08');
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2('#0e0b08', 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      120
    );
    const initialPreset = CAMERA_PRESETS[cameraPresetRef.current];
    camera.position.set(...initialPreset.pos);
    _currentLookAt.set(...initialPreset.target);
    camera.lookAt(_currentLookAt);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.minPolarAngle = 0.05;
    controls.minDistance = 6;
    controls.maxDistance = 26;
    controls.target.copy(_currentLookAt);

    controls.addEventListener('start', () => {
      cameraTransitionActiveRef.current = false;
    });

    // 4. 3-Point Warm Tavern & Cool Rim Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#fde68a', '#1e1b4b', 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fffbeb', 2.4);
    keyLight.position.set(8, 18, 9);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 36;
    const d = 11.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#60a5fa', 1.15);
    rimLight.position.set(-10, 12, -10);
    scene.add(rimLight);

    const candleFillLight = new THREE.PointLight('#f59e0b', 18, 22, 1.6);
    candleFillLight.position.set(-7.5, 4.5, -7.5);
    scene.add(candleFillLight);

    const candleFillLight2 = new THREE.PointLight('#fb923c', 16, 22, 1.6);
    candleFillLight2.position.set(7.5, 4.5, 7.5);
    scene.add(candleFillLight2);

    // 5. Composite Multi-Part Procedural Walnut & Brass RPG Tabletop Arena (THREE.Group)
    const tableGroup = new THREE.Group();
    const { albedoMap, roughnessMap } = createWalnutTableTextures(maxAnisotropy);

    // Part A: Extended dark oak tavern table surround so nothing floats in void
    const outerTableGeo = new THREE.PlaneGeometry(90, 90);
    const outerTableMat = new THREE.MeshStandardMaterial({
      color: '#170e08',
      roughness: 0.78,
      metalness: 0.05,
    });
    const outerTableMesh = new THREE.Mesh(outerTableGeo, outerTableMat);
    outerTableMesh.rotation.x = -Math.PI / 2;
    outerTableMesh.position.y = -0.16;
    outerTableMesh.receiveShadow = !isSoftwareGl;
    tableGroup.add(outerTableMesh);

    // Part B: Main Octagonal Recessed Walnut Rolling Surface (y = 0)
    const trayRadius = 9.4;
    const trayDeckGeo = new THREE.CylinderGeometry(trayRadius, trayRadius * 1.03, 0.3, 8);
    trayDeckGeo.rotateY(Math.PI / 8);
    const trayDeckMat = new THREE.MeshStandardMaterial({
      map: albedoMap,
      roughnessMap,
      roughness: 0.46,
      metalness: 0.08,
    });
    const trayDeckMesh = new THREE.Mesh(trayDeckGeo, trayDeckMat);
    trayDeckMesh.position.y = -0.15;
    trayDeckMesh.receiveShadow = !isSoftwareGl;
    tableGroup.add(trayDeckMesh);

    // Part C: 8 Carved Walnut Raised Perimeter Walls + Brushed Brass Corner Bollards
    const wallHeight = 1.15;
    const wallThickness = 0.68;
    const apothem = trayRadius * Math.cos(Math.PI / 8); // ~8.68
    const sideLength = 2 * trayRadius * Math.sin(Math.PI / 8) + 0.55;

    const wallWoodMat = new THREE.MeshStandardMaterial({
      map: albedoMap,
      color: '#3a2010',
      roughness: 0.52,
      metalness: 0.1,
    });

    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: '#d4a359',
      roughness: 0.22,
      metalness: 0.88,
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const wallSegmentGroup = new THREE.Group();

      // Main wooden rail wall
      const railGeo = new THREE.BoxGeometry(sideLength, wallHeight, wallThickness);
      const railMesh = new THREE.Mesh(railGeo, wallWoodMat);
      railMesh.position.y = wallHeight / 2;
      railMesh.castShadow = !isSoftwareGl;
      railMesh.receiveShadow = !isSoftwareGl;
      wallSegmentGroup.add(railMesh);

      // Inlaid top brass strip along each wall
      const stripGeo = new THREE.BoxGeometry(sideLength * 0.92, 0.06, wallThickness * 0.45);
      const stripMesh = new THREE.Mesh(stripGeo, brassTrimMat);
      stripMesh.position.y = wallHeight + 0.03;
      wallSegmentGroup.add(stripMesh);

      wallSegmentGroup.position.set(
        Math.sin(angle) * apothem,
        0,
        Math.cos(angle) * apothem
      );
      wallSegmentGroup.rotation.y = angle;
      tableGroup.add(wallSegmentGroup);

      // Ornate Brass Corner Pillar at each vertex of the octagon
      const cornerAngle = angle + Math.PI / 8;
      const cornerDist = trayRadius * 0.995;
      const pillarGeo = new THREE.CylinderGeometry(0.46, 0.52, wallHeight + 0.18, 12);
      const pillarMesh = new THREE.Mesh(pillarGeo, brassTrimMat);
      pillarMesh.position.set(
        Math.sin(cornerAngle) * cornerDist,
        (wallHeight + 0.18) / 2,
        Math.cos(cornerAngle) * cornerDist
      );
      pillarMesh.castShadow = !isSoftwareGl;
      tableGroup.add(pillarMesh);
    }

    scene.add(tableGroup);

    // 6. Cannon-es Physics World Setup
    const world = new CANNON.World();
    world.gravity.set(0, -32, 0);
    world.allowSleep = true;

    const tablePhysMat = new CANNON.Material('walnutTable');
    const diePhysMat = new CANNON.Material('gemstoneDie');

    world.addContactMaterial(
      new CANNON.ContactMaterial(tablePhysMat, diePhysMat, {
        friction: 0.35,
        restitution: 0.42,
      })
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(diePhysMat, diePhysMat, {
        friction: 0.18,
        restitution: 0.62,
      })
    );

    // Ground plane at y = 0
    const groundBody = new CANNON.Body({
      mass: 0,
      material: tablePhysMat,
      shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // 8 Physics Wall Barriers matching the octagonal walnut tray rails
    const innerBound = apothem - wallThickness * 0.55;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const wallBody = new CANNON.Body({
        mass: 0,
        material: tablePhysMat,
        shape: new CANNON.Box(new CANNON.Vec3(sideLength / 2, 6, 0.5)),
      });
      wallBody.position.set(
        Math.sin(angle) * innerBound,
        3,
        Math.cos(angle) * innerBound
      );
      wallBody.quaternion.setFromEuler(0, angle, 0);
      world.addBody(wallBody);
    }

    const contactShadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(2.1, 2.1);

    const activeDice: ActiveDieEntity[] = [];
    let isRollingBatch = false;
    let rollElapsedSeconds = 0;

    // Clean up existing dice from scene and physics world
    const clearActiveDice = () => {
      for (const d of activeDice) {
        scene.remove(d.group);
        scene.remove(d.shadowMesh);
        scene.remove(d.badgeSprite);
        world.removeBody(d.body);
      }
      activeDice.length = 0;
    };

    // Spawn and throw the configured batch of dice
    const spawnAndThrowDice = () => {
      clearActiveDice();

      const { diceCount: count, sides: dieSides, gemstone: gemId } = configRef.current;
      const gemConfig = GEMSTONE_MATERIALS[gemId] || GEMSTONE_MATERIALS.ruby;

      callbacksRef.current.onRollStart();
      diceAudio.playThrowSound(count);

      isRollingBatch = true;
      rollElapsedSeconds = 0;

      // Arrange throw origin from one side of the tray with randomized spread
      const throwAngleBase = (Math.random() - 0.5) * 0.7;
      const cols = Math.ceil(Math.sqrt(count));

      for (let i = 0; i < count; i++) {
        const built = buildGemstoneDie(dieSides, gemConfig, isSoftwareGl, maxAnisotropy);
        scene.add(built.group);

        // Contact shadow plane on table surface (y = 0.015 to avoid coplanar Z-fighting)
        const shadowMat = new THREE.MeshBasicMaterial({
          map: contactShadowTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.5,
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.015;
        scene.add(shadowMesh);

        // Floating settled result badge sprite (hidden while tumbling)
        const badgeSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ transparent: true, opacity: 0 })
        );
        badgeSprite.scale.set(0.95, 0.95, 0.95);
        badgeSprite.visible = false;
        scene.add(badgeSprite);

        const row = Math.floor(i / cols);
        const col = i % cols;
        const spreadX = (col - (cols - 1) / 2) * 1.95 + (Math.random() - 0.5) * 0.35;
        const spreadZ = 3.2 + row * 1.65 + (Math.random() - 0.5) * 0.35;
        const startY = 3.6 + (i % 3) * 0.85 + Math.random() * 0.4;

        const body = new CANNON.Body({
          mass: 1.2,
          material: diePhysMat,
          shape: built.cannonShape,
          linearDamping: 0.15,
          angularDamping: 0.14,
        });

        body.position.set(spreadX, startY, spreadZ);

        // Random initial 3D orientation
        const q = new THREE.Quaternion().setFromEuler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        body.quaternion.set(q.x, q.y, q.z, q.w);

        // Energetic inward throw velocity & spin torque
        const speed = 7.5 + Math.random() * 4.5;
        const dirX = -spreadX * 0.65 + Math.sin(throwAngleBase) * 3 + (Math.random() - 0.5) * 3.5;
        const dirZ = -1.0 + (Math.random() - 0.5) * 2.5;
        const len = Math.hypot(dirX, dirZ) || 1;

        body.velocity.set(
          (dirX / len) * speed,
          -2.5 - Math.random() * 2.0,
          (dirZ / len) * speed
        );

        body.angularVelocity.set(
          (Math.random() - 0.5) * 28,
          (Math.random() - 0.5) * 28,
          (Math.random() - 0.5) * 28
        );

        // Listen for physical collisions to trigger procedural wood/crystal clatter sound
        body.addEventListener('collide', (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
          const impactVel = Math.abs(event.contact.getImpactVelocityAlongNormal());
          if (impactVel > 0.55) {
            const isGemOnGem = event.body && event.body.mass > 0;
            diceAudio.playCollision(impactVel, isGemOnGem);
          }
        });

        world.addBody(body);

        activeDice.push({
          id: i + 1,
          sides: dieSides,
          gemstone: gemId,
          group: built.group,
          body,
          faces: built.faces,
          shadowMesh,
          badgeSprite,
          settled: false,
          settledFrames: 0,
          finalValue: 1,
        });
      }
    };

    spawnRollFnRef.current = spawnAndThrowDice;

    // Pre-warm shaders once on hardware WebGL
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycaster for interactive clicking on dice in the tray to re-tumble an individual die
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Ignore camera orbit drags

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const meshes: THREE.Object3D[] = activeDice.map((d) => d.group);
      const hits = raycaster.intersectObjects(meshes, true);

      if (hits.length > 0 && !isRollingBatch) {
        // Nudge the clicked die or trigger a fresh throw
        spawnAndThrowDice();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 7. Animation & Physics Loop with Software-WebGL Pacing
    let frameId = 0;
    let isDisposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (isDisposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (isDisposed) return;

      const rawDelta = clock.getDelta();
      const dt = Math.min(rawDelta, 0.1);

      // Smooth exponential camera preset transition
      if (cameraTransitionActiveRef.current) {
        const targetPreset = CAMERA_PRESETS[cameraPresetRef.current];
        _targetCamPos.set(...targetPreset.pos);
        _targetLookAt.set(...targetPreset.target);

        const alpha = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(_targetCamPos, alpha);
        _currentLookAt.lerp(_targetLookAt, alpha);
        controls.target.copy(_currentLookAt);

        if (camera.position.distanceToSquared(_targetCamPos) < 0.005) {
          cameraTransitionActiveRef.current = false;
        }
      }

      controls.update();

      // Advance physics simulation
      world.step(1 / 60, dt, 4);

      if (isRollingBatch) {
        rollElapsedSeconds += dt;
      }

      let allSettled = activeDice.length > 0;

      for (let i = 0; i < activeDice.length; i++) {
        const d = activeDice[i];
        const b = d.body;

        // Keep dice inside octagonal tray if an extreme bounce occurs
        const horizDistSq = b.position.x * b.position.x + b.position.z * b.position.z;
        if (horizDistSq > 7.6 * 7.6) {
          const factor = 7.4 / Math.sqrt(horizDistSq);
          b.position.x *= factor;
          b.position.z *= factor;
          b.velocity.x *= -0.5;
          b.velocity.z *= -0.5;
        }

        // Sync Three.js Group with Cannon Body
        d.group.position.set(b.position.x, b.position.y, b.position.z);
        d.group.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);

        // Update contact shadow position and scale with height
        d.shadowMesh.position.x = b.position.x;
        d.shadowMesh.position.z = b.position.z;
        const heightAboveTable = Math.max(0, b.position.y - 0.85);
        const shadowScale = 1 + heightAboveTable * 0.18;
        d.shadowMesh.scale.setScalar(shadowScale);
        (d.shadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0.12,
          0.52 - heightAboveTable * 0.08
        );

        // Check if die has physically come to rest
        const vSq = b.velocity.lengthSquared();
        const wSq = b.angularVelocity.lengthSquared();

        if (!d.settled) {
          if ((vSq < 0.04 && wSq < 0.08 && rollElapsedSeconds > 0.45) || rollElapsedSeconds > 3.6) {
            d.settledFrames += 1;
            if (d.settledFrames >= (isSoftwareGl ? 3 : 10) || rollElapsedSeconds > 3.6) {
              d.settled = true;
              b.velocity.setZero();
              b.angularVelocity.setZero();

              // Resolve top-most face normal
              _quat.copy(d.group.quaternion);
              const { value, localNormal } = getTopFaceValue(_quat, d.faces);
              d.finalValue = value;

              // Gently align the winning face normal toward +Y so high-facet dice look crisp
              _worldFaceNormal.copy(localNormal).applyQuaternion(_quat).normalize();
              _alignQuat.setFromUnitVectors(_worldFaceNormal, _upVec);
              d.group.quaternion.premultiply(_alignQuat);
              b.quaternion.set(
                d.group.quaternion.x,
                d.group.quaternion.y,
                d.group.quaternion.z,
                d.group.quaternion.w
              );

              // Show floating value medallion above settled die
              const gemCfg = GEMSTONE_MATERIALS[d.gemstone];
              const isCrit = value === d.sides && d.sides > 2;
              const isFumble = value === 1 && d.sides >= 20;
              d.badgeSprite.material.dispose();
              d.badgeSprite.material = createValueBadgeMaterial(
                value,
                gemCfg.inlayColor,
                isCrit,
                isFumble,
                maxAnisotropy
              );
              d.badgeSprite.position.set(b.position.x, b.position.y + 1.45, b.position.z);
              d.badgeSprite.visible = true;
            } else {
              allSettled = false;
            }
          } else {
            d.settledFrames = 0;
            allSettled = false;
          }
        } else {
          // Gentle hover bob on the result badge
          d.badgeSprite.position.set(
            b.position.x,
            b.position.y + 1.42 + Math.sin(clock.elapsedTime * 2.5 + d.id) * 0.05,
            b.position.z
          );
        }
      }

      if (isRollingBatch && allSettled) {
        isRollingBatch = false;
        const results: IndividualDieResult[] = activeDice.map((d, idx) => ({
          dieIndex: idx + 1,
          sides: d.sides,
          value: d.finalValue,
          isMax: d.finalValue === d.sides,
          isMin: d.finalValue === 1,
          gemstone: d.gemstone,
        }));

        const hasCrit = results.some((r) => r.isMax && r.sides >= 6);
        const hasFumble = results.some((r) => r.isMin && r.sides >= 20);
        diceAudio.playSettleChime(hasCrit, hasFumble);
        callbacksRef.current.onRollComplete(results);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Perform initial showcase roll on mount
    spawnAndThrowDice();
    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      clearActiveDice();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Trigger a new throw whenever rollTrigger increments
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (spawnRollFnRef.current) {
      spawnRollFnRef.current();
    }
  }, [rollTrigger]);

  return (
    <div
      ref={canvasMountRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D Gemstone Dice Rolling Tabletop"
    />
  );
};

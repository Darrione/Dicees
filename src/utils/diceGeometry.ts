import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GemstoneMaterialConfig } from '../types/dice';
import { getDieFaceNumeralTexture } from './textures';

export interface DieFaceDescriptor {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  value: number;
}

export interface BuiltDieAsset {
  group: THREE.Group;
  cannonShape: CANNON.Shape;
  faces: DieFaceDescriptor[];
  topReadoutSprite?: THREE.Mesh;
}

/**
 * Extracts unique planar faces (grouped by normal direction) from any non-indexed
 * or indexed convex Three.js BufferGeometry.
 */
function extractUniqueFaces(geometry: THREE.BufferGeometry): {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  radius: number;
}[] {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = nonIndexed.getAttribute('position');
  const triCount = posAttr.count / 3;

  const clusters: {
    normal: THREE.Vector3;
    centers: THREE.Vector3[];
    areas: number[];
  }[] = [];

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  for (let i = 0; i < triCount; i++) {
    vA.fromBufferAttribute(posAttr, i * 3);
    vB.fromBufferAttribute(posAttr, i * 3 + 1);
    vC.fromBufferAttribute(posAttr, i * 3 + 2);

    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab);
    const area = cb.length() * 0.5;
    if (area < 1e-5) continue;
    const normal = cb.normalize().clone();
    const triCenter = new THREE.Vector3()
      .add(vA)
      .add(vB)
      .add(vC)
      .multiplyScalar(1 / 3);

    // Find matching cluster by normal dot product
    let matched = false;
    for (const cluster of clusters) {
      if (cluster.normal.dot(normal) > 0.96) {
        cluster.centers.push(triCenter);
        cluster.areas.push(area);
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({
        normal,
        centers: [triCenter],
        areas: [area],
      });
    }
  }

  return clusters.map((c) => {
    const weightedCenter = new THREE.Vector3();
    let totalArea = 0;
    for (let i = 0; i < c.centers.length; i++) {
      weightedCenter.addScaledVector(c.centers[i], c.areas[i]);
      totalArea += c.areas[i];
    }
    if (totalArea > 0) weightedCenter.divideScalar(totalArea);

    // Project center onto the face plane
    const dist = weightedCenter.dot(c.normal);
    const planeCenter = c.normal.clone().multiplyScalar(dist);

    return {
      normal: c.normal.clone().normalize(),
      center: planeCenter,
      radius: Math.sqrt(totalArea / Math.PI),
    };
  });
}

/**
 * Creates a custom Pentagonal Trapezohedron (standard 10-sided RPG die) geometry.
 */
function createD10Geometry(radius: number = 1.05): THREE.BufferGeometry {
  const vertices: number[] = [];
  const H = radius * 0.98;
  const h = radius * 0.145;
  const r = radius * 0.96;

  const topApex = new THREE.Vector3(0, H, 0);
  const botApex = new THREE.Vector3(0, -H, 0);

  const ringPoints: THREE.Vector3[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    const y = i % 2 === 0 ? h : -h;
    ringPoints.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
  }

  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    // Ensure outward winding
    const center = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(center) < 0) {
      vertices.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    } else {
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  };

  for (let i = 0; i < 10; i++) {
    const next = (i + 1) % 10;
    const next2 = (i + 2) % 10;
    if (i % 2 === 0) {
      // Upper kite face split into 2 coplanar triangles
      pushTri(topApex, ringPoints[i], ringPoints[next]);
      pushTri(topApex, ringPoints[next], ringPoints[next2]);
    } else {
      // Lower kite face split into 2 coplanar triangles
      pushTri(botApex, ringPoints[i], ringPoints[next]);
      pushTri(botApex, ringPoints[next], ringPoints[next2]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a Bipyramid / Trapezohedron geometry for custom N-sided dice (e.g. d3, d5, d7, d14, d16, d24)
 */
function createCustomBipyramidGeometry(sides: number, radius: number = 1.05): THREE.BufferGeometry {
  const n = Math.max(3, Math.ceil(sides / 2));
  const H = radius * 1.02;
  const r = radius * 0.92;
  const topApex = new THREE.Vector3(0, H, 0);
  const botApex = new THREE.Vector3(0, -H, 0);

  const vertices: number[] = [];
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i * Math.PI * 2) / n;
    ring.push(new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
  }

  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const center = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
    const norm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (norm.dot(center) < 0) {
      vertices.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    } else {
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  };

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    pushTri(topApex, ring[i], ring[next]);
    pushTri(botApex, ring[next], ring[i]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates Fibonacci-distributed unit normals for high-facet dice (e.g. d30, d50, d100)
 */
function generateFibonacciFaces(sides: number, radius: number): DieFaceDescriptor[] {
  const faces: DieFaceDescriptor[] = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < sides; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / sides);
    const normal = new THREE.Vector3(
      Math.cos(theta) * Math.sin(phi),
      Math.cos(phi),
      Math.sin(theta) * Math.sin(phi)
    ).normalize();

    faces.push({
      normal,
      center: normal.clone().multiplyScalar(radius * 0.92),
      value: i + 1,
    });
  }
  return faces;
}

/**
 * Converts a Three.js BufferGeometry into a Cannon-es ConvexPolyhedron for accurate
 * polyhedral rigid-body rolling & resting on faces.
 */
function createCannonConvexFromGeometry(geometry: THREE.BufferGeometry, scale: number = 1): CANNON.ConvexPolyhedron {
  const posAttr = geometry.getAttribute('position');
  const uniqueVerts: CANNON.Vec3[] = [];
  const vertMap: number[] = [];
  const eps = 1e-3;

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i) * scale;
    const vy = posAttr.getY(i) * scale;
    const vz = posAttr.getZ(i) * scale;

    let foundIdx = -1;
    for (let j = 0; j < uniqueVerts.length; j++) {
      const u = uniqueVerts[j];
      if (
        Math.abs(u.x - vx) < eps &&
        Math.abs(u.y - vy) < eps &&
        Math.abs(u.z - vz) < eps
      ) {
        foundIdx = j;
        break;
      }
    }

    if (foundIdx === -1) {
      foundIdx = uniqueVerts.length;
      uniqueVerts.push(new CANNON.Vec3(vx, vy, vz));
    }
    vertMap.push(foundIdx);
  }

  const faces: number[][] = [];
  const indexAttr = geometry.getIndex();
  const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

  for (let i = 0; i < triCount; i++) {
    const i0 = indexAttr ? indexAttr.getX(i * 3) : i * 3;
    const i1 = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1;
    const i2 = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2;

    const a = vertMap[i0];
    const b = vertMap[i1];
    const c = vertMap[i2];
    if (a === b || b === c || a === c) continue;

    // Ensure outward normal for Cannon.js ConvexPolyhedron
    const va = uniqueVerts[a];
    const vb = uniqueVerts[b];
    const vc = uniqueVerts[c];
    const ab = vb.vsub(va);
    const ac = vc.vsub(va);
    const cross = ab.cross(ac);
    const center = new CANNON.Vec3(
      (va.x + vb.x + vc.x) / 3,
      (va.y + vb.y + vc.y) / 3,
      (va.z + vb.z + vc.z) / 3
    );

    if (cross.dot(center) < 0) {
      faces.push([a, c, b]);
    } else {
      faces.push([a, b, c]);
    }
  }

  return new CANNON.ConvexPolyhedron({ vertices: uniqueVerts, faces });
}

/**
 * Builds a complete multi-part 3D Gemstone Die Group:
 * 1. Primary Silhouette: Faceted translucent gemstone body (MeshPhysicalMaterial)
 * 2. Secondary Read: Inner crystalline cut-gem heart core + Gilded metallic edge cage
 * 3. Accent Details: Engraved gilded numeral decals on every face
 */
export function buildGemstoneDie(
  sides: number,
  gemstoneConfig: GemstoneMaterialConfig,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): BuiltDieAsset {
  const group = new THREE.Group();
  const radius = 0.92;

  let hullGeo: THREE.BufferGeometry;
  let cannonShape: CANNON.Shape;
  let extractedFaces: { normal: THREE.Vector3; center: THREE.Vector3; radius: number }[] = [];

  if (sides === 2) {
    // Runic Coin / Medallion
    hullGeo = new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, radius * 0.34, 24);
    cannonShape = new CANNON.Cylinder(radius * 0.95, radius * 0.95, radius * 0.34, 16);
    extractedFaces = [
      { normal: new THREE.Vector3(0, 1, 0), center: new THREE.Vector3(0, radius * 0.17, 0), radius: radius * 0.65 },
      { normal: new THREE.Vector3(0, -1, 0), center: new THREE.Vector3(0, -radius * 0.17, 0), radius: radius * 0.65 },
    ];
  } else if (sides === 4) {
    hullGeo = new THREE.TetrahedronGeometry(radius * 1.12, 0);
    cannonShape = createCannonConvexFromGeometry(hullGeo);
    extractedFaces = extractUniqueFaces(hullGeo);
  } else if (sides === 6) {
    const s = radius * 1.24;
    hullGeo = new THREE.BoxGeometry(s, s, s);
    cannonShape = new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2));
    extractedFaces = extractUniqueFaces(hullGeo);
  } else if (sides === 8) {
    hullGeo = new THREE.OctahedronGeometry(radius * 1.08, 0);
    cannonShape = createCannonConvexFromGeometry(hullGeo);
    extractedFaces = extractUniqueFaces(hullGeo);
  } else if (sides === 10) {
    hullGeo = createD10Geometry(radius * 1.05);
    cannonShape = createCannonConvexFromGeometry(hullGeo);
    extractedFaces = extractUniqueFaces(hullGeo);
  } else if (sides === 12) {
    hullGeo = new THREE.DodecahedronGeometry(radius * 1.02, 0);
    cannonShape = createCannonConvexFromGeometry(hullGeo);
    extractedFaces = extractUniqueFaces(hullGeo);
  } else if (sides === 20) {
    hullGeo = new THREE.IcosahedronGeometry(radius * 1.04, 0);
    cannonShape = createCannonConvexFromGeometry(hullGeo);
    extractedFaces = extractUniqueFaces(hullGeo);
  } else if (sides <= 24) {
    // Custom polyhedral bipyramid for d3, d5, d7, d14, d16, d24, etc.
    hullGeo = createCustomBipyramidGeometry(sides, radius * 1.04);
    cannonShape = createCannonConvexFromGeometry(hullGeo);
    extractedFaces = extractUniqueFaces(hullGeo);
  } else {
    // High-facet geodesic gemstone for d30, d50, d100, or custom high-N dice
    hullGeo = new THREE.IcosahedronGeometry(radius * 1.02, 1);
    const physGeo = new THREE.DodecahedronGeometry(radius * 1.0, 0);
    cannonShape = createCannonConvexFromGeometry(physGeo);
    extractedFaces = extractUniqueFaces(hullGeo);
  }

  // Part 1: Outer Faceted Translucent Gemstone Body
  const gemMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(gemstoneConfig.color),
    attenuationColor: new THREE.Color(gemstoneConfig.attenuationColor),
    attenuationDistance: 1.35,
    roughness: gemstoneConfig.roughness,
    metalness: 0.05,
    ior: gemstoneConfig.ior,
    transmission: isSoftwareGl ? 0 : gemstoneConfig.transmission,
    transparent: true,
    opacity: isSoftwareGl ? 0.78 : 1.0,
    thickness: 1.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    flatShading: true,
    envMapIntensity: 1.4,
  });

  const hullMesh = new THREE.Mesh(hullGeo, gemMaterial);
  hullMesh.castShadow = !isSoftwareGl;
  hullMesh.receiveShadow = !isSoftwareGl;
  group.add(hullMesh);

  // Part 2: Secondary Read — Inner Cut-Crystal Refractive Core (roughness delta >= 0.25)
  const coreGeo = new THREE.OctahedronGeometry(radius * 0.44, 0);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(gemstoneConfig.coreColor),
    emissive: new THREE.Color(gemstoneConfig.attenuationColor),
    emissiveIntensity: 0.35,
    roughness: 0.38,
    metalness: 0.65,
    flatShading: true,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMaterial);
  group.add(coreMesh);

  // Part 3: Secondary Read — Gilded Metallic Facet Edge Cage
  const edgesGeo = new THREE.EdgesGeometry(hullGeo, 12);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(gemstoneConfig.inlayColor),
    transparent: true,
    opacity: 0.52,
  });
  const edgeLines = new THREE.LineSegments(edgesGeo, edgeMaterial);
  group.add(edgeLines);

  // Part 4: Accent Details — Engraved Gilded Numeral Decals on Faces
  const faces: DieFaceDescriptor[] = [];

  if (sides <= 24 && extractedFaces.length >= sides) {
    // Map numbers 1..sides to the extracted geometric faces
    for (let i = 0; i < sides; i++) {
      const f = extractedFaces[i];
      const val = i + 1;

      // For d4, face pointing DOWN has its opposite vertex pointing UP, or we read the top-most face normal.
      // By placing decal on every face and reading the face normal most aligned with +Y, every die reads its top face!
      faces.push({
        normal: f.normal.clone(),
        center: f.center.clone(),
        value: val,
      });

      const decalSize = Math.min(Math.max(f.radius * 0.92, 0.34), 0.78);
      const planeGeo = new THREE.PlaneGeometry(decalSize, decalSize);
      const tex = getDieFaceNumeralTexture(val, gemstoneConfig.inlayColor, maxAnisotropy, val === sides);

      const decalMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });

      const decalMesh = new THREE.Mesh(planeGeo, decalMat);
      decalMesh.position.copy(f.center).addScaledVector(f.normal, 0.008);

      const targetPos = f.center.clone().add(f.normal);
      decalMesh.lookAt(targetPos);
      group.add(decalMesh);
    }
  } else {
    // For high-sided custom dice (e.g. d30, d50, d100, or custom N where faces > 24),
    // decorate major facets and populate exact Fibonacci normal descriptors for 1..sides
    const fibFaces = generateFibonacciFaces(sides, radius);
    faces.push(...fibFaces);

    const step = Math.max(1, Math.floor(extractedFaces.length / Math.min(sides, 20)));
    let num = 1;
    for (let i = 0; i < extractedFaces.length && num <= sides; i += step) {
      const f = extractedFaces[i];
      const displayVal = i === 0 ? sides : num;
      const decalSize = 0.36;
      const planeGeo = new THREE.PlaneGeometry(decalSize, decalSize);
      const tex = getDieFaceNumeralTexture(displayVal, gemstoneConfig.inlayColor, maxAnisotropy, displayVal === sides);
      const decalMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const decalMesh = new THREE.Mesh(planeGeo, decalMat);
      decalMesh.position.copy(f.center).addScaledVector(f.normal, 0.008);
      decalMesh.lookAt(f.center.clone().add(f.normal));
      group.add(decalMesh);
      num += Math.max(1, Math.floor(sides / 16));
    }
  }

  return {
    group,
    cannonShape,
    faces,
  };
}

/**
 * Determines which die face value is currently pointing most directly upward (+Y world axis)
 */
const _worldNormal = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

export function getTopFaceValue(
  dieQuat: THREE.Quaternion,
  faces: DieFaceDescriptor[]
): { value: number; localNormal: THREE.Vector3 } {
  let bestDot = -Infinity;
  let bestFace = faces[0];

  for (let i = 0; i < faces.length; i++) {
    _worldNormal.copy(faces[i].normal).applyQuaternion(dieQuat);
    const dot = _worldNormal.dot(_upAxis);
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = faces[i];
    }
  }

  return {
    value: bestFace ? bestFace.value : 1,
    localNormal: bestFace ? bestFace.normal : new THREE.Vector3(0, 1, 0),
  };
}

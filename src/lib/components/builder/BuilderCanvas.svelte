<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
  import { STLLoader } from "three/addons/loaders/STLLoader.js";

  export let widthMm: number;
  export let depthMm: number;
  export let heightMm: number;
  export let hasCornerProfile: "yes" | "no";

  const WALL_MM = 10;
  const mm = (v: number) => v / 1000;

  // Rotation helper: degrees -> radians
  const deg = (d: number) => (d * Math.PI) / 180;

  // --- Height / z-fighting tuning ---
  const EPSILON_M = mm(0.2); // 0.2mm
  const HOVER_LIFT_MM = 100; // new-module lift
  const HOVER_LIFT_M = mm(HOVER_LIFT_MM);

  // Existing-module lift (lower)
  const MOVE_HOVER_LIFT_MM = 30;
  const MOVE_HOVER_LIFT_M = mm(MOVE_HOVER_LIFT_MM);

  // Drag/click threshold tuning (Step A)
  const DRAG_START_DIST_PX = 8; // pixels
  const DRAG_START_DELAY_MS = 150; // ms

  // Snapping / collision tuning (MVP)
  const SNAP_TOLERANCE = mm(10);
  const SNAP_OVERLAP_MIN = mm(9);
  const FOOTPRINT_Y = EPSILON_M;

  // STL units: Fusion exports in mm, scene uses meters
  const STL_MM_TO_M = 0.001;

  let host: HTMLDivElement;

  // Three runtime
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let controls: OrbitControls | null = null;
  let ro: ResizeObserver | null = null;
  let raf = 0;

  // Drawer
  let drawerGroup: THREE.Group | null = null;

  // Drawer inner bounds in meters (updated when props change)
  let innerWm = mm(400);
  let innerDm = mm(300);
  let innerHm = mm(80);

  // Ray/pointer
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  // ===== Module config (easy to add more later) =====
  type ModuleDef = {
    id: string;
    label: string;
    file: string; // under /modules/...
    rotation: [number, number, number]; // radians
  };

  const DEFAULT_STL_ROT: [number, number, number] = [deg(-90), 0, 0];

  const modulesCatalog: ModuleDef[] = [
    { id: "tile_2_small", label: "Tile 2 Small", file: "/modules/tile_2_small.stl", rotation: DEFAULT_STL_ROT },
    { id: "tile_3_small", label: "Tile 3 Small", file: "/modules/tile_3_small.stl", rotation: DEFAULT_STL_ROT },
    {
      id: "tile_3_small_profile",
      label: "Tile 3 Small Profile",
      file: "/modules/tile_3_small_profile.stl",
      rotation: DEFAULT_STL_ROT
    },
    { id: "tile_3_small_slot", label: "Tile 3 Small Slot", file: "/modules/tile_3_small_slot.stl", rotation: DEFAULT_STL_ROT }
  ];

  // Cache loaded STL geometry + dims so we can instantiate quickly
  type LoadedModule = {
    id: string;
    geom: THREE.BufferGeometry; // normalized (pivot: footprint-center, bottom on y=0)
    wM: number;
    dM: number;
    hM: number;
    rotation: [number, number, number];
  };

  const stlLoader = new STLLoader();
  const loaded = new Map<string, LoadedModule>();
  let stlReady = false;

  // Robust normalization (same transform chain as runtime)
  function normalizeGeometryForRotation(
    geom: THREE.BufferGeometry,
    rot: [number, number, number]
  ): { geom: THREE.BufferGeometry; RELbox: THREE.Box3 } {
    const g = geom.clone();

    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    const group = new THREE.Group();
    group.add(mesh);
    group.rotation.set(rot[0], rot[1], rot[2]);

    const box = new THREE.Box3();
    const center = new THREE.Vector3();

    for (let i = 0; i < 3; i++) {
      box.setFromObject(group);
      box.getCenter(center);

      const desiredWorldShift = new THREE.Vector3(-center.x, -box.min.y, -center.z);

      const invRot = new THREE.Euler(-rot[0], -rot[1], -rot[2], "XYZ");
      const localShift = desiredWorldShift.clone().applyEuler(invRot);

      g.translate(localShift.x, localShift.y, localShift.z);
    }

    box.setFromObject(group);
    (mesh.material as THREE.Material).dispose();

    return { geom: g, RELbox: box };
  }

  async function loadAllStls() {
    stlReady = false;
    loaded.clear();

    const tasks = modulesCatalog.map((def) => {
      return new Promise<void>((resolve, reject) => {
        stlLoader.load(
          def.file,
          (geometry) => {
            geometry.scale(STL_MM_TO_M, STL_MM_TO_M, STL_MM_TO_M);
            geometry.computeVertexNormals();

            const normalized = normalizeGeometryForRotation(geometry, def.rotation);
            const effBox = normalized.RELbox;

            const size = new THREE.Vector3();
            effBox.getSize(size);

            loaded.set(def.id, {
              id: def.id,
              geom: normalized.geom,
              wM: size.x,
              hM: size.y,
              dM: size.z,
              rotation: def.rotation
            });

            resolve();
          },
          undefined,
          (err) => reject(err)
        );
      });
    });

    await Promise.all(tasks);
    stlReady = true;
  }

  // ===== Placed modules =====
  let modules: THREE.Object3D[] = [];

  // ===== Selection visuals (A.1): subtle tint only, no outlines =====
  let selectedModule: THREE.Object3D | null = null;

  // Subtle neutral gray (works on black & white)
  const SELECT_EMISSIVE = new THREE.Color(0x2b2b2b);
  const SELECT_EMISSIVE_INTENSITY = 0.35;

  function applySelectedVisuals(obj: THREE.Object3D) {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;

      const mats = Array.isArray(m.material) ? m.material : [m.material];

      if (!m.userData.__selBackup) m.userData.__selBackup = new WeakMap();
      const wm: WeakMap<any, any> = m.userData.__selBackup;

      for (const one of mats) {
        const sm = one as any;
        if (!sm) continue;

        if (!wm.has(one)) {
          wm.set(one, {
            emissive: sm.emissive?.clone?.() ?? null,
            emissiveIntensity: typeof sm.emissiveIntensity === "number" ? sm.emissiveIntensity : null
          });
        }

        if (sm.emissive && sm.emissive.copy) sm.emissive.copy(SELECT_EMISSIVE);
        if (typeof sm.emissiveIntensity === "number") sm.emissiveIntensity = SELECT_EMISSIVE_INTENSITY;

        sm.needsUpdate = true;
      }
    });
  }

  function clearSelectedVisuals(obj: THREE.Object3D) {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;

      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const wm: WeakMap<any, any> | undefined = m.userData.__selBackup;
      if (!wm) return;

      for (const one of mats) {
        const sm = one as any;
        const b = wm.get(one);
        if (!b) continue;

        if (b.emissive && sm.emissive?.copy) sm.emissive.copy(b.emissive);
        if (typeof b.emissiveIntensity === "number" && typeof sm.emissiveIntensity === "number") {
          sm.emissiveIntensity = b.emissiveIntensity;
        }

        sm.needsUpdate = true;
      }
    });
  }

  function setSelected(obj: THREE.Object3D | null) {
    if (selectedModule === obj) return;

    if (selectedModule) clearSelectedVisuals(selectedModule);
    selectedModule = obj;
    if (selectedModule) applySelectedVisuals(selectedModule);
  }

  function disposeObject(obj: THREE.Object3D) {
    scene?.remove(obj);
    obj.traverse((o) => {
      const anyObj = o as any;
      if (anyObj.geometry?.dispose) anyObj.geometry.dispose();
      if (anyObj.material) {
        if (Array.isArray(anyObj.material)) anyObj.material.forEach((m: any) => m.dispose?.());
        else anyObj.material.dispose?.();
      }
    });
  }

  function deleteModule(obj: THREE.Object3D) {
    if (!scene) return;

    const idx = modules.indexOf(obj);
    if (idx !== -1) modules.splice(idx, 1);

    if (selectedModule === obj) setSelected(null);

    disposeObject(obj);
  }

  function onRemoveSelected() {
    if (!selectedModule) return;
    deleteModule(selectedModule);
  }

  // ===== Cursor helper (Step A) =====
  function setCursor(kind: "default" | "grab" | "grabbing") {
    if (!renderer) return;
    renderer.domElement.style.cursor = kind;
  }

  // Footprint (single reusable mesh)
  let footprint: THREE.Mesh | null = null;

  function ensureFootprint() {
    if (!scene || footprint) return;

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.22,
      color: new THREE.Color(0x000000),
      depthWrite: false
    });

    footprint = new THREE.Mesh(geo, mat);
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.y = FOOTPRINT_Y;
    footprint.visible = false;
    scene.add(footprint);
  }

  function showFootprint(wM: number, dM: number, x: number, z: number, valid: boolean) {
    if (!footprint) return;

    footprint.scale.set(wM, dM, 1);
    footprint.position.set(x, FOOTPRINT_Y, z);

    const mat = footprint.material as THREE.MeshBasicMaterial;
    mat.color.setHex(valid ? 0x000000 : 0x8b1e1e);
    mat.opacity = valid ? 0.22 : 0.28;

    footprint.visible = true;
  }

  function hideFootprint() {
    if (footprint) footprint.visible = false;
  }

  // Drag-from-palette state
  let paletteDragActive = false;
  let paletteDragItem: ModuleDef | null = null;
  let ghost: THREE.Object3D | null = null;

  // Drag-existing-module state
  let moduleDragActive = false;
  let draggedModule: THREE.Object3D | null = null;
  let dragOffset = new THREE.Vector2(0, 0);
  let lastValidPos = new THREE.Vector3();
  let hasLastValid = false;

  // ===== Step A.1: click-vs-drag state machines (now includes orbit) =====
  type PendingDrag = {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startTime: number;
    moved: boolean;
    dragging: boolean;
    timer: number | null;
    kind: "palette" | "module" | "orbit";
    moduleDef?: ModuleDef;
    moduleObj?: THREE.Object3D;
  };

  let pending: PendingDrag | null = null;

  function clearPendingTimer() {
    if (pending?.timer != null) {
      window.clearTimeout(pending.timer);
      pending.timer = null;
    }
  }

  function distPx(ax: number, ay: number, bx: number, by: number) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function buildDrawer(innerW: number, innerD: number, innerH: number) {
    const group = new THREE.Group();
    const wall = mm(WALL_MM);

    const W = innerW;
    const D = innerD;
    const H = innerH;

    const opacity = hasCornerProfile === "yes" ? 0.18 : 0.25;

    const mat = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity
    });

    const bottomCenterY = -(wall / 2) - EPSILON_M;

    // Bottom
    {
      const geo = new THREE.BoxGeometry(W + 2 * wall, wall, D + 2 * wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, bottomCenterY, 0);
      group.add(mesh);
    }

    const wallCenterY = (H + wall) / 2 - EPSILON_M;

    // Left wall
    {
      const geo = new THREE.BoxGeometry(wall, H + wall, D + 2 * wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-(W / 2 + wall / 2), wallCenterY, 0);
      group.add(mesh);
    }

    // Right wall
    {
      const geo = new THREE.BoxGeometry(wall, H + wall, D + 2 * wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(W / 2 + wall / 2, wallCenterY, 0);
      group.add(mesh);
    }

    // Back wall
    {
      const geo = new THREE.BoxGeometry(W + 2 * wall, H + wall, wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, wallCenterY, -(D / 2 + wall / 2));
      group.add(mesh);
    }

    // Front wall
    {
      const geo = new THREE.BoxGeometry(W + 2 * wall, H + wall, wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, wallCenterY, D / 2 + wall / 2);
      group.add(mesh);
    }

    // Inner bounds helper (wireframe box)
    {
      const innerGeo = new THREE.BoxGeometry(W, H, D);
      const edges = new THREE.EdgesGeometry(innerGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial());
      line.position.set(0, H / 2 - EPSILON_M, 0);
      group.add(line);
    }

    return group;
  }

  function disposeGroup(group: THREE.Group) {
    group.traverse((obj: THREE.Object3D) => {
      const anyObj = obj as any;
      if (anyObj.geometry?.dispose) anyObj.geometry.dispose();
      if (anyObj.material) {
        if (Array.isArray(anyObj.material)) anyObj.material.forEach((m: any) => m.dispose?.());
        else anyObj.material.dispose?.();
      }
    });
  }

  function rebuildDrawer() {
    if (!scene) return;

    innerWm = mm(Math.max(1, widthMm || 1));
    innerDm = mm(Math.max(1, depthMm || 1));
    innerHm = mm(Math.max(1, heightMm || 1));

    if (drawerGroup) {
      scene.remove(drawerGroup);
      disposeGroup(drawerGroup);
      drawerGroup = null;
    }

    drawerGroup = buildDrawer(innerWm, innerDm, innerHm);
    scene.add(drawerGroup);

    if (controls) {
      controls.target.set(0, innerHm / 2 - EPSILON_M, 0);
      controls.update();
    }
  }

  // Create a renderable STL instance (ghost or solid)
  function makeModuleInstance(defId: string, kind: "ghost" | "solid") {
    const info = loaded.get(defId);
    if (!info) return null;

    const mat =
      kind === "ghost"
        ? new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.55, color: new THREE.Color(0x222222) })
        : new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.92, color: new THREE.Color(0x222222) });

    const mesh = new THREE.Mesh(info.geom, mat);

    const group = new THREE.Group();
    group.add(mesh);

    group.rotation.set(info.rotation[0], info.rotation[1], info.rotation[2]);

    group.userData.wM = info.wM;
    group.userData.dM = info.dM;
    group.userData.hM = info.hM;
    group.userData.defId = defId;

    // bottom at y=EPSILON_M in world
    group.position.set(0, EPSILON_M, 0);

    return group;
  }

  function getDims(obj: THREE.Object3D) {
    const wM = obj.userData.wM ?? 0.15;
    const dM = obj.userData.dM ?? 0.1;
    const hM = obj.userData.hM ?? 0.02;
    return { wM, dM, hM };
  }

  function clientToNdc(clientX: number, clientY: number) {
    if (!renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    pointerNdc.set(x * 2 - 1, -(y * 2 - 1));

    const over = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    return { over };
  }

  function intersectDragPlane(): THREE.Vector3 | null {
    if (!camera) return null;
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(dragPlane, hit);
    return ok ? hit : null;
  }

  type AABB2 = { minX: number; maxX: number; minZ: number; maxZ: number };

  function getAABBAt(x: number, z: number, wM: number, dM: number): AABB2 {
    const halfW = wM / 2;
    const halfD = dM / 2;
    return { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD };
  }

  function getAABB(obj: THREE.Object3D): AABB2 {
    const { wM, dM } = getDims(obj);
    return getAABBAt(obj.position.x, obj.position.z, wM, dM);
  }

  function overlap1D(aMin: number, aMax: number, bMin: number, bMax: number) {
    return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
  }

  function aabbIntersects(a: AABB2, b: AABB2) {
    return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  }

  function snapXZ(xIn: number, zIn: number, wM: number, dM: number, ignoreObj: THREE.Object3D | null) {
    let x = xIn;
    let z = zIn;

    const halfW = wM / 2;
    const halfD = dM / 2;

    let bestDx = SNAP_TOLERANCE + 1;
    let bestX: number | null = null;

    let bestDz = SNAP_TOLERANCE + 1;
    let bestZ: number | null = null;

    // Wall snaps
    {
      const left = -innerWm / 2 + halfW;
      const right = innerWm / 2 - halfW;
      const dLeft = Math.abs(x - left);
      const dRight = Math.abs(x - right);
      if (dLeft < bestDx && dLeft <= SNAP_TOLERANCE) {
        bestDx = dLeft;
        bestX = left;
      }
      if (dRight < bestDx && dRight <= SNAP_TOLERANCE) {
        bestDx = dRight;
        bestX = right;
      }

      const back = -innerDm / 2 + halfD;
      const front = innerDm / 2 - halfD;
      const dBack = Math.abs(z - back);
      const dFront = Math.abs(z - front);
      if (dBack < bestDz && dBack <= SNAP_TOLERANCE) {
        bestDz = dBack;
        bestZ = back;
      }
      if (dFront < bestDz && dFront <= SNAP_TOLERANCE) {
        bestDz = dFront;
        bestZ = front;
      }
    }

    // Module snaps
    const movingAabb = getAABBAt(x, z, wM, dM);

    for (const other of modules) {
      if (ignoreObj && other === ignoreObj) continue;

      const otherAabb = getAABB(other);

      // X snaps require Z overlap
      const zOverlap = overlap1D(movingAabb.minZ, movingAabb.maxZ, otherAabb.minZ, otherAabb.maxZ);
      if (zOverlap >= SNAP_OVERLAP_MIN) {
        const cand1 = otherAabb.maxX + halfW;
        const cand2 = otherAabb.minX - halfW;
        const cand3 = otherAabb.minX + halfW;
        const cand4 = otherAabb.maxX - halfW;

        for (const cx of [cand1, cand2, cand3, cand4]) {
          const d = Math.abs(x - cx);
          if (d < bestDx && d <= SNAP_TOLERANCE) {
            bestDx = d;
            bestX = cx;
          }
        }
      }

      // Z snaps require X overlap
      const xOverlap = overlap1D(movingAabb.minX, movingAabb.maxX, otherAabb.minX, otherAabb.maxX);
      if (xOverlap >= SNAP_OVERLAP_MIN) {
        const cand1 = otherAabb.maxZ + halfD;
        const cand2 = otherAabb.minZ - halfD;
        const cand3 = otherAabb.minZ + halfD;
        const cand4 = otherAabb.maxZ - halfD;

        for (const cz of [cand1, cand2, cand3, cand4]) {
          const d = Math.abs(z - cz);
          if (d < bestDz && d <= SNAP_TOLERANCE) {
            bestDz = d;
            bestZ = cz;
          }
        }
      }
    }

    if (bestX !== null) x = bestX;
    if (bestZ !== null) z = bestZ;

    return { x, z };
  }

  function isCollisionAt(x: number, z: number, wM: number, dM: number, ignore: THREE.Object3D | null) {
    const a = getAABBAt(x, z, wM, dM);
    for (const other of modules) {
      if (ignore && other === ignore) continue;
      if (aabbIntersects(a, getAABB(other))) return true;
    }
    return false;
  }

  function isInsideDrawerAt(x: number, z: number, wM: number, dM: number) {
    const halfW = wM / 2;
    const halfD = dM / 2;

    const minX = -innerWm / 2 + halfW;
    const maxX = innerWm / 2 - halfW;
    const minZ = -innerDm / 2 + halfD;
    const maxZ = innerDm / 2 - halfD;

    return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
  }

  // IMPORTANT: No clamping here. We allow free drag outside.
  function solvePlacement(rawX: number, rawZ: number, wM: number, dM: number, ignore: THREE.Object3D | null) {
    let x = rawX;
    let z = rawZ;

    ({ x, z } = snapXZ(x, z, wM, dM, ignore));

    const inside = isInsideDrawerAt(x, z, wM, dM);
    const coll = isCollisionAt(x, z, wM, dM, ignore);
    const valid = inside && !coll;

    return { x, z, valid };
  }

  // ===== Start actual drag (palette) =====
  function startPaletteDrag(item: ModuleDef, ev: PointerEvent) {
    if (!scene || !renderer || !camera) return;
    if (!stlReady) return;

    ensureFootprint();
    if (controls) controls.enabled = false;

    paletteDragActive = true;
    paletteDragItem = item;

    ghost = makeModuleInstance(item.id, "ghost");
    if (!ghost) return;
    scene.add(ghost);

    setCursor("grabbing");

    onPalettePointerMove(ev);

    window.addEventListener("pointermove", onPalettePointerMove, { passive: false });
    window.addEventListener("pointerup", onPalettePointerUp, { passive: false });
  }

  // ===== Palette pointer handlers (thresholded) =====
  function onPalettePointerDown(item: ModuleDef, ev: PointerEvent) {
    if (!scene || !renderer || !camera) return;
    if (!stlReady) return;

    // A.1: palette down always deselect immediately
    setSelected(null);

    ev.preventDefault();
    ev.stopPropagation();

    clearPendingTimer();
    pending = {
      pointerId: ev.pointerId,
      startClientX: ev.clientX,
      startClientY: ev.clientY,
      startTime: performance.now(),
      moved: false,
      dragging: false,
      timer: null,
      kind: "palette",
      moduleDef: item
    };

    setCursor("grabbing");
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);

    pending.timer = window.setTimeout(() => {
      if (pending && pending.kind === "palette" && pending.pointerId === ev.pointerId && !pending.dragging) {
        pending.dragging = true;
        startPaletteDrag(item, ev);
      }
    }, DRAG_START_DELAY_MS);

    window.addEventListener("pointermove", onPendingPointerMove, { passive: false });
    window.addEventListener("pointerup", onPendingPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPendingPointerUp as any, { passive: false });
  }

  function onPalettePointerMove(ev: PointerEvent) {
    if (!paletteDragActive || !ghost || !paletteDragItem) return;
    if (!renderer) return;

    ev.preventDefault();

    const ndcInfo = clientToNdc(ev.clientX, ev.clientY);
    if (!ndcInfo || !ndcInfo.over) {
      ghost.visible = false;
      hideFootprint();
      return;
    }

    ghost.visible = true;

    const hit = intersectDragPlane();
    if (!hit) return;

    const { wM, dM } = getDims(ghost);
    const solved = solvePlacement(hit.x, hit.z, wM, dM, null);

    showFootprint(wM, dM, solved.x, solved.z, solved.valid);

    ghost.position.set(solved.x, EPSILON_M + HOVER_LIFT_M, solved.z);

    ghost.traverse((o) => {
      const anyObj = o as any;
      if (anyObj.material?.color?.setHex) {
        anyObj.material.color.setHex(solved.valid ? 0x222222 : 0x8b1e1e);
        anyObj.material.opacity = solved.valid ? 0.55 : 0.6;
      }
    });
  }

  function onPalettePointerUp(ev: PointerEvent) {
    if (!paletteDragActive || !paletteDragItem) return;

    ev.preventDefault();

    if (ghost && ghost.visible) {
      const { wM, dM } = getDims(ghost);
      const x = ghost.position.x;
      const z = ghost.position.z;

      const valid = isInsideDrawerAt(x, z, wM, dM) && !isCollisionAt(x, z, wM, dM, null);

      if (valid) {
        const placed = makeModuleInstance(paletteDragItem.id, "solid");
        if (placed) {
          placed.position.set(x, EPSILON_M, z);
          scene!.add(placed);
          modules.push(placed);
        }
      }
    }

    if (ghost) {
      disposeObject(ghost);
      ghost = null;
    }

    paletteDragActive = false;
    paletteDragItem = null;

    hideFootprint();

    window.removeEventListener("pointermove", onPalettePointerMove as any);
    window.removeEventListener("pointerup", onPalettePointerUp as any);

    if (controls) controls.enabled = true;
    setCursor("default");

    // A.1: after palette drop, nothing should be selected
    setSelected(null);
  }

  // ===== Drag existing modules in drawer (thresholded + hover lift) =====
  function pickModuleAt(clientX: number, clientY: number): { obj: THREE.Object3D; point: THREE.Vector3 } | null {
    if (!renderer || !camera) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    const over = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    if (!over) return null;

    pointerNdc.set(x * 2 - 1, -(y * 2 - 1));
    raycaster.setFromCamera(pointerNdc, camera);

    const hits = raycaster.intersectObjects(modules, true);
    const h = hits[0];
    if (!h) return null;

    let obj: THREE.Object3D = h.object;
    while (obj.parent && !modules.includes(obj)) obj = obj.parent;

    if (!modules.includes(obj)) return null;

    return { obj, point: h.point.clone() };
  }

  function startModuleDrag(obj: THREE.Object3D, ev: PointerEvent) {
    if (!renderer) return;

    ensureFootprint();

    moduleDragActive = true;
    draggedModule = obj;

    if (controls) controls.enabled = false;

    setCursor("grabbing");

    const ndcInfo = clientToNdc(ev.clientX, ev.clientY);
    if (ndcInfo && ndcInfo.over) {
      const planeHit = intersectDragPlane();
      if (planeHit) {
        dragOffset.set(draggedModule.position.x - planeHit.x, draggedModule.position.z - planeHit.z);
      } else {
        dragOffset.set(0, 0);
      }
    } else {
      dragOffset.set(0, 0);
    }

    lastValidPos.copy(draggedModule.position);
    hasLastValid = true;

    onModulePointerMove(ev);

    window.addEventListener("pointermove", onModulePointerMove, { passive: false });
    window.addEventListener("pointerup", onModulePointerUp, { passive: false });
  }

  // A.1: pointerdown on empty canvas should NOT deselect immediately.
  // We start a pending "orbit" gesture; if it's a click (no move), deselect on pointerup.
  function onCanvasPointerDown(ev: PointerEvent) {
    if (paletteDragActive || moduleDragActive) return;

    const hit = pickModuleAt(ev.clientX, ev.clientY);

    if (!hit) {
      clearPendingTimer();
      pending = {
        pointerId: ev.pointerId,
        startClientX: ev.clientX,
        startClientY: ev.clientY,
        startTime: performance.now(),
        moved: false,
        dragging: false,
        timer: null,
        kind: "orbit"
      };

      // allow orbit
      if (controls) controls.enabled = true;

      renderer!.domElement.setPointerCapture(ev.pointerId);

      // no delay needed; we just track moved/not moved
      window.addEventListener("pointermove", onPendingPointerMove, { passive: true });
      window.addEventListener("pointerup", onPendingPointerUp, { passive: true });
      window.addEventListener("pointercancel", onPendingPointerUp as any, { passive: true });

      // don't stopPropagation -> let OrbitControls do its thing
      return;
    }

    // Select on pointerdown (no lift)
    setSelected(hit.obj);

    clearPendingTimer();
    pending = {
      pointerId: ev.pointerId,
      startClientX: ev.clientX,
      startClientY: ev.clientY,
      startTime: performance.now(),
      moved: false,
      dragging: false,
      timer: null,
      kind: "module",
      moduleObj: hit.obj
    };

    renderer!.domElement.setPointerCapture(ev.pointerId);

    // While pending on a module, disable orbit so it doesn't steal the gesture.
    if (controls) controls.enabled = false;

    setCursor("grabbing");

    pending.timer = window.setTimeout(() => {
      if (pending && pending.kind === "module" && pending.pointerId === ev.pointerId && !pending.dragging) {
        pending.dragging = true;
        startModuleDrag(hit.obj, ev);
      }
    }, DRAG_START_DELAY_MS);

    window.addEventListener("pointermove", onPendingPointerMove, { passive: false });
    window.addEventListener("pointerup", onPendingPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPendingPointerUp as any, { passive: false });

    ev.preventDefault();
    ev.stopPropagation();
  }

  function onModulePointerMove(ev: PointerEvent) {
    if (!moduleDragActive || !draggedModule) return;
    if (!renderer) return;

    ev.preventDefault();

    const ndcInfo = clientToNdc(ev.clientX, ev.clientY);
    if (!ndcInfo || !ndcInfo.over) {
      hideFootprint();
      return;
    }

    const hit = intersectDragPlane();
    if (!hit) return;

    const { wM, dM } = getDims(draggedModule);

    const rawX = hit.x + dragOffset.x;
    const rawZ = hit.z + dragOffset.y;

    const solved = solvePlacement(rawX, rawZ, wM, dM, draggedModule);

    showFootprint(wM, dM, solved.x, solved.z, solved.valid);

    draggedModule.position.set(solved.x, EPSILON_M + MOVE_HOVER_LIFT_M, solved.z);

    if (solved.valid) {
      lastValidPos.set(solved.x, EPSILON_M, solved.z);
      hasLastValid = true;
    }

    draggedModule.traverse((o) => {
      const anyObj = o as any;
      if (anyObj.material?.color?.setHex) {
        anyObj.material.color.setHex(solved.valid ? 0x222222 : 0x8b1e1e);
      }
    });
  }

  function onModulePointerUp(ev: PointerEvent) {
    if (!moduleDragActive || !draggedModule) return;

    ev.preventDefault();

    const { wM, dM } = getDims(draggedModule);
    const x = draggedModule.position.x;
    const z = draggedModule.position.z;

    const valid = isInsideDrawerAt(x, z, wM, dM) && !isCollisionAt(x, z, wM, dM, draggedModule);

    if (!valid) {
      if (hasLastValid) {
        draggedModule.position.copy(lastValidPos);
      } else {
        deleteModule(draggedModule);
      }
    } else {
      draggedModule.position.set(x, EPSILON_M, z);
    }

    draggedModule.traverse((o) => {
      const anyObj = o as any;
      if (anyObj.material?.color?.setHex) {
        anyObj.material.color.setHex(0x222222);
      }
    });

    hideFootprint();

    moduleDragActive = false;
    draggedModule = null;
    hasLastValid = false;

    window.removeEventListener("pointermove", onModulePointerMove as any);
    window.removeEventListener("pointerup", onModulePointerUp as any);

    // After drag+drop it should NOT be selected.
    setSelected(null);

    if (controls) controls.enabled = true;
    setCursor("default");
  }

  // ===== Pending pointer move/up (shared) =====
  function onPendingPointerMove(ev: PointerEvent) {
    if (!pending) return;
    if (ev.pointerId !== pending.pointerId) return;

    const d = distPx(ev.clientX, ev.clientY, pending.startClientX, pending.startClientY);
    if (d >= DRAG_START_DIST_PX) pending.moved = true;

    // Only prevent default for module/palette; do not interfere with orbit.
    if (pending.kind !== "orbit") ev.preventDefault();

    // If moved enough before timer, start drag immediately
    if (!pending.dragging && pending.moved) {
      clearPendingTimer();
      pending.dragging = true;

      if (pending.kind === "palette" && pending.moduleDef) {
        startPaletteDrag(pending.moduleDef, ev);
      } else if (pending.kind === "module" && pending.moduleObj) {
        startModuleDrag(pending.moduleObj, ev);
      } else if (pending.kind === "orbit") {
        // nothing to start; OrbitControls handles it. We just mark it as "dragging".
      }
    }
  }

  function onPendingPointerUp(ev: PointerEvent) {
    if (!pending) return;
    if (ev.pointerId !== pending.pointerId) return;

    // Only prevent default for module/palette; do not interfere with orbit.
    if (pending.kind !== "orbit") ev.preventDefault();

    const wasDragging = pending.dragging;
    const kind = pending.kind;
    const modObj = pending.moduleObj;

    clearPendingTimer();

    window.removeEventListener("pointermove", onPendingPointerMove as any);
    window.removeEventListener("pointerup", onPendingPointerUp as any);
    window.removeEventListener("pointercancel", onPendingPointerUp as any);

    pending = null;

    // If we never started a drag, treat as click:
    if (!wasDragging) {
      if (kind === "module" && modObj) {
        // Already selected on pointerdown; keep selected.
        if (controls) controls.enabled = true;
        setCursor("grab");
        return;
      }

      if (kind === "orbit") {
        // Click on empty/låda => deselect.
        setSelected(null);
        return;
      }

      // palette click does nothing (selection already cleared on pointerdown)
      if (controls) controls.enabled = true;
      setCursor("default");
      return;
    }

    // If we DID start a drag, its own pointerup handler will run (palette/module).
    // For orbit: keep selection intact (do nothing).
  }

  // Hover cursor feedback over canvas modules (Step A)
  function onCanvasPointerMoveForCursor(ev: PointerEvent) {
    if (paletteDragActive || moduleDragActive || pending) return;
    const hit = pickModuleAt(ev.clientX, ev.clientY);
    setCursor(hit ? "grab" : "default");
  }

  // Palette preview helper (2D footprint)
  function previewStyleById(defId: string) {
    const info = loaded.get(defId);
    if (!info) return "width:70%;height:70%;";
    const wMm = info.wM * 1000;
    const dMm = info.dM * 1000;
    const max = Math.max(wMm, dMm);
    const wPct = Math.round((wMm / max) * 100);
    const dPct = Math.round((dMm / max) * 100);
    return `width:${wPct}%;height:${dPct}%;`;
  }

  onMount(async () => {
    if (!browser) return;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, 1, 0.01, 50);
    camera.position.set(0.6, 0.5, 0.6);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    renderer.domElement.style.touchAction = "none";
    setCursor("default");

    scene.add(new THREE.AmbientLight(undefined, 0.7));
    const dir = new THREE.DirectionalLight(undefined, 0.8);
    dir.position.set(1, 2, 1);
    scene.add(dir);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.GridHelper(2, 20));
    scene.add(new THREE.AxesHelper(0.3));

    ensureFootprint();

    await loadAllStls();

    renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown, { capture: true });
    renderer.domElement.addEventListener("pointermove", onCanvasPointerMoveForCursor, { passive: true });

    ro = new ResizeObserver(() => {
      if (!renderer || !camera) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls?.update();
      renderer?.render(scene!, camera!);
    };
    loop();
  });

  $: if (browser && scene && widthMm && depthMm && heightMm) {
    rebuildDrawer();
  }

  onDestroy(() => {
    if (!browser) return;

    clearPendingTimer();
    pending = null;

    window.removeEventListener("pointermove", onPendingPointerMove as any);
    window.removeEventListener("pointerup", onPendingPointerUp as any);
    window.removeEventListener("pointercancel", onPendingPointerUp as any);

    window.removeEventListener("pointermove", onPalettePointerMove as any);
    window.removeEventListener("pointerup", onPalettePointerUp as any);
    window.removeEventListener("pointermove", onModulePointerMove as any);
    window.removeEventListener("pointerup", onModulePointerUp as any);

    if (renderer?.domElement) {
      renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown, { capture: true } as any);
      renderer.domElement.removeEventListener("pointermove", onCanvasPointerMoveForCursor as any);
    }

    if (raf) cancelAnimationFrame(raf);
    ro?.disconnect();
    controls?.dispose();

    if (ghost) {
      disposeObject(ghost);
      ghost = null;
    }

    hideFootprint();
    if (footprint) {
      disposeObject(footprint);
      footprint = null;
    }

    // clear selection visuals
    if (selectedModule) {
      clearSelectedVisuals(selectedModule);
      selectedModule = null;
    }

    for (const m of modules) disposeObject(m);
    modules = [];

    if (scene && drawerGroup) {
      scene.remove(drawerGroup);
      disposeGroup(drawerGroup);
    }

    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
    }

    for (const entry of loaded.values()) {
      entry.geom.dispose();
    }
    loaded.clear();

    scene = null;
    camera = null;
    renderer = null;
    controls = null;
    drawerGroup = null;
  });
</script>

<div class="builder-shell">
  <div class="canvas-area">
    <!-- Top-left delete button -->
    <div class="canvas-ui">
      <button
        type="button"
        class="remove-btn"
        on:click={onRemoveSelected}
        disabled={!selectedModule}
        aria-label="Remove selected module"
        title="Remove selected module"
      >
        Remove
      </button>
    </div>

    <div class="viewport" bind:this={host}></div>
  </div>

  <aside class="palette">
    <div class="palette-header">
      <div class="title">Modules</div>
      <div class="subtitle">{stlReady ? "Drag into the drawer" : "Loading STL..."}</div>
    </div>

    <div class="palette-list">
      {#each modulesCatalog as m}
        <button
          type="button"
          class="palette-item radius-m focus-ring"
          disabled={!stlReady}
          on:pointerdown={(e) => onPalettePointerDown(m, e)}
        >
          <div class="preview">
            <div class="preview-box" style={previewStyleById(m.id)}></div>
          </div>

          <div class="label">{m.label}</div>
          <div class="meta">{m.file.replace("/modules/", "")}</div>
        </button>
      {/each}
    </div>
  </aside>
</div>

<style>
  .builder-shell {
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 260px;
    gap: 12px;
    align-items: stretch;
  }

  .canvas-area {
    position: relative;
    min-height: 360px;
  }

  .canvas-ui {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    pointer-events: none;
  }

  .remove-btn {
    pointer-events: auto;
    border-radius: 10px;
    padding: 8px 10px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(6px);
    transition: opacity 0.15s ease-out, transform 0.15s ease-out;
  }

  .remove-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none;
  }

  .remove-btn:not(:disabled):hover {
    opacity: 0.95;
    transform: translateY(-1px);
  }

  .viewport {
    height: 100%;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
  }

  .palette {
    border-radius: 12px;
    padding: 12px;
    display: grid;
    gap: 12px;
    align-content: start;
    background: rgba(0, 0, 0, 0.03);
  }

  .palette-header .title {
    font-weight: 600;
  }
  .palette-header .subtitle {
    opacity: 0.7;
    font-size: 0.9rem;
    margin-top: 2px;
  }

  .palette-list {
    display: grid;
    gap: 10px;
  }

  .palette-item {
    text-align: left;
    padding: 10px 10px;
    background: rgba(255, 255, 255, 0.8);
    transition: opacity 0.15s ease-out, transform 0.15s ease-out;
    user-select: none;
    touch-action: none;
    display: grid;
    grid-template-columns: 56px 1fr;
    grid-template-rows: auto auto;
    column-gap: 10px;
    row-gap: 2px;
    align-items: center;
  }

  .palette-item[disabled] {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }

  .palette-item:hover:not([disabled]) {
    opacity: 0.95;
    transform: translateY(-1px);
  }

  .preview {
    grid-row: 1 / span 2;
    width: 56px;
    height: 44px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.04);
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .preview-box {
    background: rgba(0, 0, 0, 0.35);
    border-radius: 6px;
  }

  .label {
    font-weight: 600;
    line-height: 1.1;
  }

  .meta {
    opacity: 0.7;
    font-size: 0.85rem;
    line-height: 1.1;
  }
</style>

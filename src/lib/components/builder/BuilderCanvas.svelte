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
  const HOVER_LIFT_MM = 100; // tweakable
  const HOVER_LIFT_M = mm(HOVER_LIFT_MM);

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

  // Initial orientation:
  // Fusion/Tinkercad typically behaves like Z-up. Three is Y-up.
  // A common correction is -90° around X.
  const DEFAULT_STL_ROTATION: [number, number, number] = [deg(-90), 0, 0];

  const modulesCatalog: ModuleDef[] = [
    {
      id: "tile_2_small",
      label: "Tile 2 Small",
      file: "/modules/tile_2_small.stl",
      rotation: DEFAULT_STL_ROTATION
    },
    {
      id: "tile_3_small",
      label: "Tile 3 Small",
      file: "/modules/tile_3_small.stl",
      rotation: DEFAULT_STL_ROTATION
    },
    {
      id: "tile_3_small_profile",
      label: "Tile 3 Small Profile",
      file: "/modules/tile_3_small_profile.stl",
      rotation: DEFAULT_STL_ROTATION
    },
    {
      id: "tile_3_small_slot",
      label: "Tile 3 Small Slot",
      file: "/modules/tile_3_small_slot.stl",
      rotation: DEFAULT_STL_ROTATION
    }
  ];

  // Cache loaded STL geometry + dims so we can instantiate quickly
  type LoadedModule = {
    id: string;
    geom: THREE.BufferGeometry;
    wM: number;
    dM: number;
    hM: number;
    // offset to put bottom at y=0 (in local space, meters)
    bottomOffsetY: number;
    rotation: [number, number, number];
  };

  const stlLoader = new STLLoader();
  const loaded = new Map<string, LoadedModule>();
  let stlReady = false;

  async function loadAllStls() {
    stlReady = false;

    const tasks = modulesCatalog.map((def) => {
      return new Promise<void>((resolve, reject) => {
        stlLoader.load(
          def.file,
          (geometry) => {
            // Convert mm units to meters
            geometry.scale(STL_MM_TO_M, STL_MM_TO_M, STL_MM_TO_M);

            // Ensure normals for nicer shading
            geometry.computeVertexNormals();

            // Compute bbox in meters
            geometry.computeBoundingBox();
            const bb = geometry.boundingBox!;
            const size = new THREE.Vector3();
            bb.getSize(size);

            const wM = size.x;
            const hM = size.y;
            const dM = size.z;

            // Since we apply rotation to the mesh, bbox changes.
            // Robust approach: compute "effective bbox" by creating a temp Object3D,
            // applying rotation, and measuring its Box3 once.
            const temp = new THREE.Mesh(geometry);
            temp.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);
            const box = new THREE.Box3().setFromObject(temp);
            const effSize = new THREE.Vector3();
            box.getSize(effSize);

            const effW = effSize.x;
            const effH = effSize.y;
            const effD = effSize.z;

            // bottomOffsetY should place rotated object so its minY sits at y=0 in local wrapper space
            const bottomOffsetY = -box.min.y;

            loaded.set(def.id, {
              id: def.id,
              geom: geometry,
              wM: effW,
              dM: effD,
              hM: effH,
              bottomOffsetY,
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
  let modules: THREE.Object3D[] = []; // could be Mesh or Group; we use Object3D for flexibility

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

    // Top of bottom plate at y = -EPSILON_M
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

  // Create a renderable STL instance (ghost or solid)
  function makeModuleInstance(defId: string, kind: "ghost" | "solid") {
    const info = loaded.get(defId);
    if (!info) return null;

    const mat =
      kind === "ghost"
        ? new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.55, color: new THREE.Color(0x222222) })
        : new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.92, color: new THREE.Color(0x222222) });

    const mesh = new THREE.Mesh(info.geom, mat);

    // Wrap in a group so we can apply rotation and a bottom offset cleanly
    const group = new THREE.Group();
    group.add(mesh);

    group.rotation.set(info.rotation[0], info.rotation[1], info.rotation[2]);

    // Offset so bottom sits at y=0 in group local space, then group will be positioned at y=EPSILON_M
    mesh.position.y = info.bottomOffsetY;

    // Dimensions used for collision/snap/footprint
    group.userData.wM = info.wM;
    group.userData.dM = info.dM;
    group.userData.hM = info.hM;
    group.userData.defId = defId;

    // Default: bottom at y=EPSILON_M
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

  function clampToDrawer(x: number, z: number, wM: number, dM: number) {
    const halfW = wM / 2;
    const halfD = dM / 2;

    const minX = -innerWm / 2 + halfW;
    const maxX = innerWm / 2 - halfW;
    const minZ = -innerDm / 2 + halfD;
    const maxZ = innerDm / 2 - halfD;

    return {
      x: Math.min(maxX, Math.max(minX, x)),
      z: Math.min(maxZ, Math.max(minZ, z))
    };
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

  function solvePlacement(rawX: number, rawZ: number, wM: number, dM: number, ignore: THREE.Object3D | null) {
    let { x, z } = clampToDrawer(rawX, rawZ, wM, dM);
    ({ x, z } = snapXZ(x, z, wM, dM, ignore));
    ({ x, z } = clampToDrawer(x, z, wM, dM));

    const inside = isInsideDrawerAt(x, z, wM, dM);
    const coll = isCollisionAt(x, z, wM, dM, ignore);
    const valid = inside && !coll;

    return { x, z, valid };
  }

  // ===== Palette drag handlers =====
  function onPalettePointerDown(item: ModuleDef, ev: PointerEvent) {
    if (!scene || !renderer || !camera) return;
    if (!stlReady) return;

    ev.preventDefault();
    ev.stopPropagation();

    ensureFootprint();

    if (controls) controls.enabled = false;

    paletteDragActive = true;
    paletteDragItem = item;

    ghost = makeModuleInstance(item.id, "ghost");
    if (!ghost) return;
    scene.add(ghost);

    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);

    onPalettePointerMove(ev);

    window.addEventListener("pointermove", onPalettePointerMove, { passive: false });
    window.addEventListener("pointerup", onPalettePointerUp, { passive: false });
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

    // place ghost hovering
    ghost.position.set(solved.x, EPSILON_M + HOVER_LIFT_M, solved.z);

    // tint ghost
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
  }

  // ===== Drag existing modules in drawer (still floor-bound for now) =====
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

    // ascend to the top-level module object that is in `modules`
    let obj: THREE.Object3D = h.object;
    while (obj.parent && !modules.includes(obj)) obj = obj.parent;

    if (!modules.includes(obj)) return null;

    return { obj, point: h.point.clone() };
  }

  function onCanvasPointerDown(ev: PointerEvent) {
    if (paletteDragActive || moduleDragActive) return;

    const hit = pickModuleAt(ev.clientX, ev.clientY);

    if (!hit) {
      if (controls) controls.enabled = true;
      return;
    }

    ensureFootprint();

    moduleDragActive = true;
    draggedModule = hit.obj;

    if (controls) controls.enabled = false;

    renderer!.domElement.setPointerCapture(ev.pointerId);

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

    window.addEventListener("pointermove", onModulePointerMove, { passive: false });
    window.addEventListener("pointerup", onModulePointerUp, { passive: false });

    ev.preventDefault();
    ev.stopPropagation();

    onModulePointerMove(ev);
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

    draggedModule.position.set(solved.x, EPSILON_M, solved.z);

    if (solved.valid) {
      lastValidPos.copy(draggedModule.position);
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

    const valid =
      isInsideDrawerAt(draggedModule.position.x, draggedModule.position.z, wM, dM) &&
      !isCollisionAt(draggedModule.position.x, draggedModule.position.z, wM, dM, draggedModule);

    if (!valid) {
      draggedModule.position.copy(lastValidPos);
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

    window.removeEventListener("pointermove", onModulePointerMove as any);
    window.removeEventListener("pointerup", onModulePointerUp as any);

    if (controls) controls.enabled = true;
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

    scene.add(new THREE.AmbientLight(undefined, 0.7));
    const dir = new THREE.DirectionalLight(undefined, 0.8);
    dir.position.set(1, 2, 1);
    scene.add(dir);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.GridHelper(2, 20));
    scene.add(new THREE.AxesHelper(0.3));

    rebuildDrawer();
    ensureFootprint();

    // Load STL assets (only once on mount)
    await loadAllStls();

    renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown, { capture: true });

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

  $: if (browser && scene) {
    rebuildDrawer();
  }

  onDestroy(() => {
    if (!browser) return;

    window.removeEventListener("pointermove", onPalettePointerMove as any);
    window.removeEventListener("pointerup", onPalettePointerUp as any);
    window.removeEventListener("pointermove", onModulePointerMove as any);
    window.removeEventListener("pointerup", onModulePointerUp as any);

    if (renderer?.domElement) {
      renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown, { capture: true } as any);
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

    // Dispose cached geometries
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

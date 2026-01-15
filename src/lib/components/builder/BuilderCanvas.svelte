<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";

  export let widthMm: number;
  export let depthMm: number;
  export let heightMm: number;
  export let hasCornerProfile: "yes" | "no";

  const WALL_MM = 10;
  const mm = (v: number) => v / 1000;

  // --- Height / z-fighting tuning ---
  const EPSILON_M = mm(0.2); // 0.2mm
  const HOVER_LIFT_MM = 100; // tweakable
  const HOVER_LIFT_M = mm(HOVER_LIFT_MM);

  // Snapping / collision tuning (MVP)
  const SNAP_TOLERANCE = mm(10); // 6mm
  const SNAP_OVERLAP_MIN = mm(9); // require overlap on the other axis for module-to-module snaps
  const FOOTPRINT_Y = EPSILON_M; // shadow sits just above grid to avoid flicker

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

  // Modules placed in drawer (placeholder boxes for now)
  let modules: THREE.Mesh[] = [];

  // Drawer inner bounds in meters (updated when props change)
  let innerWm = mm(400);
  let innerDm = mm(300);
  let innerHm = mm(80);

  // Ray/pointer
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0 (grid reference)
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  // Palette
  type PaletteItem = { id: string; label: string; wMm: number; dMm: number; hMm: number };

  // New module sizes (W×D×H)
  const palette: PaletteItem[] = [
    { id: "150x100", label: "150×100", wMm: 150, dMm: 100, hMm: 20 },
    { id: "150x150", label: "150×150", wMm: 150, dMm: 150, hMm: 20 },
    { id: "150x200", label: "150×200", wMm: 150, dMm: 200, hMm: 20 }
  ];

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

    // PlaneGeometry is XY; after rotation it's XZ => width maps to X, height maps to Z
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
  let paletteDragItem: PaletteItem | null = null;
  let ghost: THREE.Mesh | null = null;

  // Drag-existing-module state
  let moduleDragActive = false;
  let draggedModule: THREE.Mesh | null = null;
  let dragOffset = new THREE.Vector2(0, 0); // offset in XZ from pointer hit to module center
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

    // IMPORTANT:
    // We want the TOP of the bottom plate to be at y = -EPSILON_M.
    // Bottom plate thickness is "wall", so its center must be at y = -(wall/2) - EPSILON_M.
    const bottomCenterY = -(wall / 2) - EPSILON_M;

    // Bottom
    {
      const geo = new THREE.BoxGeometry(W + 2 * wall, wall, D + 2 * wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, bottomCenterY, 0);
      group.add(mesh);
    }

    // Walls sit on the top plane of the bottom plate => y = -EPSILON_M
    // Their height is H + wall (same as before), but shifted down by EPSILON_M.
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

    // Inner bounds helper (wireframe box) should represent interior space from y=-EPS to y=H-EPS
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

  function makeModuleMesh(wMm: number, dMm: number, hMm: number, kind: "ghost" | "solid") {
    const W = mm(wMm);
    const D = mm(dMm);
    const H = mm(hMm);

    const geo = new THREE.BoxGeometry(W, H, D);
    const mat =
      kind === "ghost"
        ? new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0.55,
            color: new THREE.Color(0x222222)
          })
        : new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0.92,
            color: new THREE.Color(0x222222)
          });

    const mesh = new THREE.Mesh(geo, mat);

    // Module bottom should be at y = +EPSILON_M (just above grid)
    // => center y = EPSILON_M + H/2
    mesh.position.set(0, EPSILON_M + H / 2, 0);

    // Store dimensions on the mesh (used for snapping/collision/clamp)
    mesh.userData.wM = W;
    mesh.userData.dM = D;
    mesh.userData.hM = H;

    return mesh;
  }

  function disposeMesh(mesh: THREE.Mesh) {
    scene?.remove(mesh);
    (mesh.geometry as THREE.BufferGeometry).dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
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

  function getDims(mesh: THREE.Mesh) {
    const wM = mesh.userData.wM ?? 0.15;
    const dM = mesh.userData.dM ?? 0.1;
    const hM = mesh.userData.hM ?? 0.02;
    return { wM, dM, hM };
  }

  function getAABBAt(x: number, z: number, wM: number, dM: number): AABB2 {
    const halfW = wM / 2;
    const halfD = dM / 2;
    return { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD };
  }

  function getAABB(mesh: THREE.Mesh): AABB2 {
    const { wM, dM } = getDims(mesh);
    return getAABBAt(mesh.position.x, mesh.position.z, wM, dM);
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

  function snapXZ(
    xIn: number,
    zIn: number,
    wM: number,
    dM: number,
    ignoreMesh: THREE.Mesh | null
  ): { x: number; z: number } {
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
      if (ignoreMesh && other === ignoreMesh) continue;

      const otherAabb = getAABB(other);

      // For X snaps: require overlap on Z
      const zOverlap = overlap1D(movingAabb.minZ, movingAabb.maxZ, otherAabb.minZ, otherAabb.maxZ);
      if (zOverlap >= SNAP_OVERLAP_MIN) {
        // Edge-to-edge (pack)
        const cand1 = otherAabb.maxX + halfW; // place our left edge to other's right edge
        const cand2 = otherAabb.minX - halfW; // place our right edge to other's left edge

        // Edge align
        const cand3 = otherAabb.minX + halfW; // align left edges
        const cand4 = otherAabb.maxX - halfW; // align right edges

        for (const cx of [cand1, cand2, cand3, cand4]) {
          const d = Math.abs(x - cx);
          if (d < bestDx && d <= SNAP_TOLERANCE) {
            bestDx = d;
            bestX = cx;
          }
        }
      }

      // For Z snaps: require overlap on X
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

  function isCollisionAt(x: number, z: number, wM: number, dM: number, ignore: THREE.Mesh | null) {
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

  function solvePlacement(
    rawX: number,
    rawZ: number,
    wM: number,
    dM: number,
    ignore: THREE.Mesh | null
  ): { x: number; z: number; valid: boolean } {
    // 1) clamp
    let { x, z } = clampToDrawer(rawX, rawZ, wM, dM);

    // 2) snap (nearest wins per axis)
    ({ x, z } = snapXZ(x, z, wM, dM, ignore));

    // 3) clamp again after snap
    ({ x, z } = clampToDrawer(x, z, wM, dM));

    // 4) validate
    const inside = isInsideDrawerAt(x, z, wM, dM);
    const coll = isCollisionAt(x, z, wM, dM, ignore);
    const valid = inside && !coll;

    return { x, z, valid };
  }

  // ===== Palette drag handlers =====
  function onPalettePointerDown(item: PaletteItem, ev: PointerEvent) {
    if (!scene || !renderer || !camera) return;

    ev.preventDefault();
    ev.stopPropagation();

    ensureFootprint();

    // lock orbit while we drag from palette
    if (controls) controls.enabled = false;

    paletteDragActive = true;
    paletteDragItem = item;

    ghost = makeModuleMesh(item.wMm, item.dMm, item.hMm, "ghost");
    scene.add(ghost);

    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);

    // Immediately position once (prevents “spawn in center”)
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

    const { wM, dM, hM } = getDims(ghost);
    const solved = solvePlacement(hit.x, hit.z, wM, dM, null);

    // Shadow (target) sits just above grid
    showFootprint(wM, dM, solved.x, solved.z, solved.valid);

    // Ghost hovers above by HOVER_LIFT_M, while its “true” placement is shown by the shadow.
    const ghostY = EPSILON_M + hM / 2 + HOVER_LIFT_M;
    ghost.position.set(solved.x, ghostY, solved.z);

    const mat = ghost.material as THREE.MeshStandardMaterial;
    mat.color.setHex(solved.valid ? 0x222222 : 0x8b1e1e);
    mat.opacity = solved.valid ? 0.55 : 0.6;
  }

  function onPalettePointerUp(ev: PointerEvent) {
    if (!paletteDragActive || !paletteDragItem) return;

    ev.preventDefault();

    // Commit if valid (use solved placement from shadow position)
    if (ghost && ghost.visible) {
      const { wM, dM, hM } = getDims(ghost);

      // The intended XZ is ghost's XZ; Y is irrelevant for validation
      const x = ghost.position.x;
      const z = ghost.position.z;

      const valid =
        isInsideDrawerAt(x, z, wM, dM) && !isCollisionAt(x, z, wM, dM, null);

      if (valid) {
        const placed = makeModuleMesh(paletteDragItem.wMm, paletteDragItem.dMm, paletteDragItem.hMm, "solid");
        placed.position.set(x, EPSILON_M + hM / 2, z);
        scene!.add(placed);
        modules.push(placed);
      }
    }

    if (ghost) {
      disposeMesh(ghost);
      ghost = null;
    }

    paletteDragActive = false;
    paletteDragItem = null;

    hideFootprint();

    window.removeEventListener("pointermove", onPalettePointerMove as any);
    window.removeEventListener("pointerup", onPalettePointerUp as any);

    if (controls) controls.enabled = true;
  }

  // ===== Drag existing modules in drawer =====
  function pickModuleAt(clientX: number, clientY: number): { mesh: THREE.Mesh; point: THREE.Vector3 } | null {
    if (!renderer || !camera) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    const over = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    if (!over) return null;

    pointerNdc.set(x * 2 - 1, -(y * 2 - 1));
    raycaster.setFromCamera(pointerNdc, camera);

    const hits = raycaster.intersectObjects(modules, false);
    const h = hits[0];
    if (!h) return null;

    return { mesh: h.object as THREE.Mesh, point: h.point.clone() };
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
    draggedModule = hit.mesh;

    if (controls) controls.enabled = false;

    renderer!.domElement.setPointerCapture(ev.pointerId);

    // compute drag offset from pointer->plane intersection
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

    const { wM, dM, hM } = getDims(draggedModule);

    const rawX = hit.x + dragOffset.x;
    const rawZ = hit.z + dragOffset.y;

    const solved = solvePlacement(rawX, rawZ, wM, dM, draggedModule);

    showFootprint(wM, dM, solved.x, solved.z, solved.valid);

    // Existing modules stay “on the floor” (bottom at y=EPSILON_M)
    draggedModule.position.set(solved.x, EPSILON_M + hM / 2, solved.z);

    if (solved.valid) {
      lastValidPos.copy(draggedModule.position);
    }

    const mat = draggedModule.material as THREE.MeshStandardMaterial;
    mat.color.setHex(solved.valid ? 0x222222 : 0x8b1e1e);
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

    const mat = draggedModule.material as THREE.MeshStandardMaterial;
    mat.color.setHex(0x222222);

    hideFootprint();

    moduleDragActive = false;
    draggedModule = null;

    window.removeEventListener("pointermove", onModulePointerMove as any);
    window.removeEventListener("pointerup", onModulePointerUp as any);

    if (controls) controls.enabled = true;
  }

  onMount(() => {
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

    // Grid stays at y=0 (reference plane)
    scene.add(new THREE.GridHelper(2, 20));
    scene.add(new THREE.AxesHelper(0.3));

    rebuildDrawer();
    ensureFootprint();

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
      disposeMesh(ghost);
      ghost = null;
    }

    hideFootprint();
    if (footprint) {
      disposeMesh(footprint);
      footprint = null;
    }

    for (const m of modules) disposeMesh(m);
    modules = [];

    if (scene && drawerGroup) {
      scene.remove(drawerGroup);
      disposeGroup(drawerGroup);
    }

    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
    }

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
      <div class="subtitle">Drag into the drawer</div>
    </div>

    <div class="palette-list">
      {#each palette as m}
        <button
          type="button"
          class="palette-item radius-m focus-ring"
          on:pointerdown={(e) => onPalettePointerDown(m, e)}
        >
          <div class="label">{m.label}</div>
          <div class="meta">{m.wMm}×{m.dMm}×{m.hMm} mm</div>
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
    grid-template-columns: 1fr 220px;
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
  }

  .palette-item:hover {
    opacity: 0.95;
    transform: translateY(-1px);
  }

  .label {
    font-weight: 600;
  }

  .meta {
    opacity: 0.7;
    font-size: 0.9rem;
    margin-top: 2px;
  }
</style>

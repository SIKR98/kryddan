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

  // Drag-from-palette state
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  type PaletteItem = { id: string; label: string; wMm: number; dMm: number; hMm: number };

  const palette: PaletteItem[] = [
    { id: "w50", label: "50 mm", wMm: 50, dMm: 50, hMm: 20 },
    { id: "w100", label: "100 mm", wMm: 100, dMm: 50, hMm: 20 },
    { id: "w150", label: "150 mm", wMm: 150, dMm: 50, hMm: 20 }
  ];

  let paletteDragActive = false;
  let paletteDragItem: PaletteItem | null = null;
  let ghost: THREE.Mesh | null = null;
  let ghostInsideDrawer = false;

  // Used to avoid Orbit “stealing” interactions on modules
  let canvasPointerDownOnModule = false;

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

    // Bottom
    {
      const geo = new THREE.BoxGeometry(W + 2 * wall, wall, D + 2 * wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, wall / 2, 0);
      group.add(mesh);
    }

    // Left wall
    {
      const geo = new THREE.BoxGeometry(wall, H + wall, D + 2 * wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-(W / 2 + wall / 2), (H + wall) / 2, 0);
      group.add(mesh);
    }

    // Right wall
    {
      const geo = new THREE.BoxGeometry(wall, H + wall, D + 2 * wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(W / 2 + wall / 2, (H + wall) / 2, 0);
      group.add(mesh);
    }

    // Back wall
    {
      const geo = new THREE.BoxGeometry(W + 2 * wall, H + wall, wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, (H + wall) / 2, -(D / 2 + wall / 2));
      group.add(mesh);
    }

    // Front wall
    {
      const geo = new THREE.BoxGeometry(W + 2 * wall, H + wall, wall);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, (H + wall) / 2, D / 2 + wall / 2);
      group.add(mesh);
    }

    // Inner bounds helper (wireframe box)
    {
      const innerGeo = new THREE.BoxGeometry(W, H, D);
      const edges = new THREE.EdgesGeometry(innerGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial());
      line.position.set(0, H / 2, 0);
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

    // Update cached bounds
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
      controls.target.set(0, innerHm / 2, 0);
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
        ? new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5, color: new THREE.Color(0x222222) })
        : new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.92, color: new THREE.Color(0x222222) });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, H / 2, 0);
    return mesh;
  }

  function disposeMesh(mesh: THREE.Mesh) {
    scene?.remove(mesh);
    (mesh.geometry as THREE.BufferGeometry).dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  }

  function setGhostValid(valid: boolean) {
    if (!ghost) return;
    const mat = ghost.material as THREE.MeshStandardMaterial;
    // grå när valid, röd när invalid
    mat.color.setHex(valid ? 0x222222 : 0x8b1e1e);
    mat.opacity = valid ? 0.5 : 0.55;
  }

  function clientToNdc(clientX: number, clientY: number) {
    if (!renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    pointerNdc.set(x * 2 - 1, -(y * 2 - 1));

    // whether pointer is over canvas
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

  function isInsideDrawerFootprint(x: number, z: number, wMm: number, dMm: number) {
    const W = mm(wMm);
    const D = mm(dMm);

    const minX = -innerWm / 2 + W / 2;
    const maxX = innerWm / 2 - W / 2;
    const minZ = -innerDm / 2 + D / 2;
    const maxZ = innerDm / 2 - D / 2;

    return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
  }

  // ===== Palette drag handlers =====
  function onPalettePointerDown(item: PaletteItem, ev: PointerEvent) {
    if (!scene || !renderer || !camera) return;

    ev.preventDefault();
    ev.stopPropagation();

    // lock orbit while we drag from palette
    if (controls) controls.enabled = false;

    paletteDragActive = true;
    paletteDragItem = item;
    ghostInsideDrawer = false;

    // create ghost
    ghost = makeModuleMesh(item.wMm, item.dMm, item.hMm, "ghost");
    scene.add(ghost);

    // capture pointer so we keep receiving moves
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);

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
      ghostInsideDrawer = false;
      return;
    }

    ghost.visible = true;

    const hit = intersectDragPlane();
    if (!hit) return;

    // place ghost on bottom, resting with y = H/2
    const H = mm(paletteDragItem.hMm);
    ghost.position.set(hit.x, H / 2, hit.z);

    ghostInsideDrawer = isInsideDrawerFootprint(hit.x, hit.z, paletteDragItem.wMm, paletteDragItem.dMm);
    setGhostValid(ghostInsideDrawer);
  }

  function onPalettePointerUp(ev: PointerEvent) {
    if (!paletteDragActive || !paletteDragItem) return;

    ev.preventDefault();

    // Commit if valid & visible
    if (ghost && ghost.visible && ghostInsideDrawer) {
      const placed = makeModuleMesh(paletteDragItem.wMm, paletteDragItem.dMm, paletteDragItem.hMm, "solid");
      placed.position.copy(ghost.position);
      scene!.add(placed);
      modules.push(placed);
    }

    // cleanup ghost
    if (ghost) {
      disposeMesh(ghost);
      ghost = null;
    }

    paletteDragActive = false;
    paletteDragItem = null;
    ghostInsideDrawer = false;

    window.removeEventListener("pointermove", onPalettePointerMove as any);
    window.removeEventListener("pointerup", onPalettePointerUp as any);

    // unlock orbit
    if (controls) controls.enabled = true;
  }

  // ===== Canvas pointer gating for OrbitControls =====
  function pickModuleAt(clientX: number, clientY: number): THREE.Mesh | null {
    if (!renderer || !camera) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    const over = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    if (!over) return null;

    pointerNdc.set(x * 2 - 1, -(y * 2 - 1));
    raycaster.setFromCamera(pointerNdc, camera);

    const hits = raycaster.intersectObjects(modules, false);
    return (hits[0]?.object as THREE.Mesh) ?? null;
  }

  function onCanvasPointerDown(ev: PointerEvent) {
    if (paletteDragActive) return;

    // if pointer is on a module => disable orbit (so orbit doesn't start)
    const hit = pickModuleAt(ev.clientX, ev.clientY);
    canvasPointerDownOnModule = !!hit;

    if (controls) controls.enabled = !canvasPointerDownOnModule;
  }

  function onCanvasPointerUp() {
    // re-enable orbit when released (unless palette drag keeps it disabled)
    if (controls && !paletteDragActive) controls.enabled = true;
    canvasPointerDownOnModule = false;
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

    scene.add(new THREE.GridHelper(2, 20));
    scene.add(new THREE.AxesHelper(0.3));

    rebuildDrawer();

    // Orbit gating when touching modules
    renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown, { capture: true });
    window.addEventListener("pointerup", onCanvasPointerUp, { capture: true });

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

    if (renderer?.domElement) {
      renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown, { capture: true } as any);
    }
    window.removeEventListener("pointerup", onCanvasPointerUp as any);

    window.removeEventListener("pointermove", onPalettePointerMove as any);
    window.removeEventListener("pointerup", onPalettePointerUp as any);

    if (raf) cancelAnimationFrame(raf);
    ro?.disconnect();
    controls?.dispose();

    // Remove ghost if any
    if (ghost) {
      disposeMesh(ghost);
      ghost = null;
    }

    // Remove modules
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

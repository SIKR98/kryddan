<script lang="ts">
  import { onMount } from 'svelte';

  type DrawerPreset = 'custom' | 'ikea-metod-maximera';

  let preset: DrawerPreset = 'custom';

  // Dimensions in millimeters
  let widthMm = 600;
  let depthMm = 450;
  let heightMm = 100;

  // Internal side corner profile (Yes/No)
  let hasCornerProfile: 'yes' | 'no' = 'no';

  // BOM / Cart-like drawer state
  let isBomOpen = false;
  let moduleCount = 0;

  // Used to trigger a short shake animation on the badge/icon
  let bumpKey = 0;

  // Wide screen heuristic:
  // - On wide viewports, auto-open BOM once when the first module is added.
  // - On small viewports, never auto-open (avoid intrusive UI).
  let isWideViewport = false;
  const WIDE_VIEWPORT_PX = 1100;

  function updateViewportFlags() {
    isWideViewport = window.innerWidth >= WIDE_VIEWPORT_PX;
  }

  function scrollToBuilder() {
    const el = document.getElementById('builder');
    if (!el) return;

    // Ensure the URL has a hash so refresh keeps the user at the builder.
    history.replaceState(null, '', '#builder');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Placeholder: later this will be called by drag-n-drop / snapping logic.
  function simulateAddModule() {
    moduleCount += 1;
    bumpKey += 1;

    if (moduleCount === 1 && isWideViewport) {
      isBomOpen = true;
    }
  }

  function toggleBom() {
    isBomOpen = !isBomOpen;
  }

  onMount(() => {
    updateViewportFlags();
    window.addEventListener('resize', updateViewportFlags);

    // If the user loads / refreshes with #builder, scroll there smoothly.
    if (window.location.hash === '#builder') {
      requestAnimationFrame(() => {
        const el = document.getElementById('builder');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    return () => window.removeEventListener('resize', updateViewportFlags);
  });
</script>

<!-- Prevent any accidental horizontal scrolling (e.g. from overlays/drawers). -->
<div class="overflow-x-hidden">
  <!-- HERO (100vh) -->
  <section class="min-h-screen bg-secondary-contrast">
    <div class="mx-auto flex min-h-screen max-w-6xl flex-col justify-between padding-l">
      <!-- Top navigation (logo left, nav right) -->
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="radius-m border-default flex h-10 w-10 items-center justify-center bg-white">
            <span class="heading-3">K</span>
          </div>
          <span class="heading-3">Kryddan</span>
        </div>

        <nav class="hidden items-center gap-6 md:flex">
          <a class="body-text ui-hover" href="#features">Features</a>
          <a class="body-text ui-hover" href="#sizes">Sizes</a>
          <a class="body-text ui-hover" href="#builder">Builder</a>
        </nav>
      </header>

      <!-- Hero content -->
      <div class="grid items-center gap-10 md:grid-cols-2">
        <div>
          <h1 class="heading-1">A quiet, angled, modular spice drawer — built to fit your space.</h1>

          <p class="body-text margin-y-m">
            Forward-angled inserts keep jars visible and easy to grab. Modules prevent rolling and rattling, and let you
            build a layout that matches your exact drawer.
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <button
              class="radius-m focus-ring bg-primary px-5 py-3 text-primary-contrast transition duration-200 ease-out hover:opacity-90"
              type="button"
              on:click={scrollToBuilder}
            >
              Build your drawer
            </button>

            <a class="radius-m border-default ui-hover focus-ring bg-white px-5 py-3" href="#sizes">
              <span class="body-text">See sizes</span>
            </a>
          </div>

          <!-- Trust strip -->
          <div class="margin-y-l grid grid-cols-2 gap-3 md:grid-cols-4">
            <div class="radius-m border-subtle bg-white padding-s">
              <div class="heading-3">Ø45 mm</div>
              <div class="body-text">Jar diameter</div>
            </div>
            <div class="radius-m border-subtle bg-white padding-s">
              <div class="heading-3">110 mm</div>
              <div class="body-text">Jar length</div>
            </div>
            <div class="radius-m border-subtle bg-white padding-s">
              <div class="heading-3">23 mm</div>
              <div class="body-text">Module height</div>
            </div>
            <div class="radius-m border-subtle bg-white padding-s">
              <div class="heading-3">IKEA-ready</div>
              <div class="body-text">Profile option</div>
            </div>
          </div>
        </div>

        <!-- Image placeholder -->
        <div class="radius-l border-default relative aspect-[4/3] overflow-hidden bg-white">
          <div class="absolute inset-0 grid place-items-center">
            <div class="text-center">
              <div class="heading-2">Product image</div>
              <p class="body-text margin-y-s">Replace with a real drawer photo / render.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Scroll hint -->
      <div class="flex items-center justify-center pb-6">
        <button class="body-text ui-hover" type="button" on:click={scrollToBuilder}>↓ Jump to builder</button>
      </div>
    </div>
  </section>

  <!-- FEATURES (simple skeleton) -->
  <section id="features" class="bg-white">
    <div class="mx-auto max-w-6xl padding-l">
      <h2 class="heading-2">Designed for structure, clarity, and quiet.</h2>
      <p class="body-text margin-y-s">
        Modular inserts keep spice jars aligned, angled, and easy to access — with less noise and no rolling.
      </p>

      <div class="margin-y-l grid gap-4 md:grid-cols-3">
        <div class="radius-m border-default padding-m">
          <h3 class="heading-3">Angled for visibility</h3>
          <p class="body-text margin-y-s">Read labels faster and grab jars comfortably.</p>
        </div>
        <div class="radius-m border-default padding-m">
          <h3 class="heading-3">Modular sizing</h3>
          <p class="body-text margin-y-s">Mix 2-, 3-, and 4-jar modules to fit your drawer.</p>
        </div>
        <div class="radius-m border-default padding-m">
          <h3 class="heading-3">Stops movement</h3>
          <p class="body-text margin-y-s">Prevents rattling, rolling, and messy re-stacking.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- SIZES (simple skeleton) -->
  <section id="sizes" class="bg-secondary-contrast">
    <div class="mx-auto max-w-6xl padding-l">
      <h2 class="heading-2">Module sizes and compatibility</h2>
      <p class="body-text margin-y-s">Each module is 120 mm deep and 23 mm tall. Choose width by number of jars.</p>

      <div class="margin-y-l grid gap-4 md:grid-cols-3">
        <div class="radius-m border-subtle bg-white padding-m">
          <h3 class="heading-3">2-jar module</h3>
          <p class="body-text margin-y-s">90 mm wide</p>
        </div>
        <div class="radius-m border-subtle bg-white padding-m">
          <h3 class="heading-3">3-jar module</h3>
          <p class="body-text margin-y-s">135 mm wide</p>
        </div>
        <div class="radius-m border-subtle bg-white padding-m">
          <h3 class="heading-3">4-jar module</h3>
          <p class="body-text margin-y-s">180 mm wide</p>
        </div>
      </div>

      <div class="margin-y-l radius-m border-subtle bg-white padding-m">
        <p class="body-text">
          Fits spice jars up to <span class="text-primary">45 mm</span> in diameter and
          <span class="text-primary">110 mm</span> in length (e.g. common brands like Santa Maria).
        </p>
      </div>
    </div>
  </section>

  <!-- BUILDER (100vh) -->
  <section id="builder" class="relative min-h-screen bg-white">
    <div class="mx-auto flex min-h-screen max-w-6xl flex-col padding-l">
      <!-- Builder topbar (full width within builder container) -->
      <div class="radius-m border-default bg-secondary-contrast padding-m w-full">
        <!-- Only the layout for the drawer preset section is changed below -->
        <div class="grid gap-4">
          <!-- Large screens: one row, preset 1/3 and controls 2/3 -->
          <div class="hidden md:grid grid-cols-3 gap-4 items-end">
            <div class="flex flex-col gap-2">
              <label class="body-text" for="preset-lg">Drawer preset</label>
              <select
                id="preset-md"
                class="radius-m border-default focus-ring bg-white px-3 py-2 w-full"
                bind:value={preset}
              >
                <option value="custom">Custom drawer</option>
                <option value="ikea-metod-maximera">IKEA METOD / MAXIMERA (example)</option>
              </select>
            </div>

            <div class="col-span-2 grid grid-cols-4 gap-3">
              <div class="flex flex-col gap-2">
                <label class="body-text" for="w-lg">Width (mm)</label>
                <input id="w-lg" class="dimension-input w-full" type="number" min="0" bind:value={widthMm} />
              </div>

              <div class="flex flex-col gap-2">
                <label class="body-text" for="d-lg">Depth (mm)</label>
                <input id="d-lg" class="dimension-input w-full" type="number" min="0" bind:value={depthMm} />
              </div>

              <div class="flex flex-col gap-2">
                <label class="body-text" for="h-lg">Height (mm)</label>
                <input id="h-lg" class="dimension-input w-full" type="number" min="0" bind:value={heightMm} />
              </div>

              <div class="flex flex-col gap-2">
                <span class="body-text">Internal profile</span>
                <div class="dimension-input w-full flex items-center justify-between">
                  <label class="flex items-center gap-2">
                    <input
                      class="focus-ring"
                      type="radio"
                      name="corner-profile-lg"
                      value="no"
                      bind:group={hasCornerProfile}
                    />
                    <span class="body-text">No</span>
                  </label>

                  <label class="flex items-center gap-2">
                    <input
                      class="focus-ring"
                      type="radio"
                      name="corner-profile-lg"
                      value="yes"
                      bind:group={hasCornerProfile}
                    />
                    <span class="body-text">Yes</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Small screens: two rows, preset full width then 4 equal boxes -->
          <div class="md:hidden grid gap-4">
            <div class="flex flex-col gap-2">
              <label class="body-text" for="preset-sm">Drawer preset</label>
              <select
                id="preset-sm"
                class="radius-m border-default focus-ring bg-white px-3 py-2 w-full"
                bind:value={preset}
              >
                <option value="custom">Custom drawer</option>
                <option value="ikea-metod-maximera">IKEA METOD / MAXIMERA (example)</option>
              </select>
            </div>

            <div class="grid grid-cols-4 gap-3">
              <div class="flex flex-col gap-2">
                <label class="body-text" for="w-sm">Width (mm)</label>
                <input id="w-sm" class="dimension-input w-full" type="number" min="0" bind:value={widthMm} />
              </div>

              <div class="flex flex-col gap-2">
                <label class="body-text" for="d-sm">Depth (mm)</label>
                <input id="d-sm" class="dimension-input w-full" type="number" min="0" bind:value={depthMm} />
              </div>

              <div class="flex flex-col gap-2">
                <label class="body-text" for="h-sm">Height (mm)</label>
                <input id="h-sm" class="dimension-input w-full" type="number" min="0" bind:value={heightMm} />
              </div>

              <div class="flex flex-col gap-2">
                <span class="body-text">Internal profile</span>
                <div class="dimension-input w-full flex items-center justify-between">
                  <label class="flex items-center gap-2">
                    <input
                      class="focus-ring"
                      type="radio"
                      name="corner-profile-sm"
                      value="no"
                      bind:group={hasCornerProfile}
                    />
                    <span class="body-text">No</span>
                  </label>

                  <label class="flex items-center gap-2">
                    <input
                      class="focus-ring"
                      type="radio"
                      name="corner-profile-sm"
                      value="yes"
                      bind:group={hasCornerProfile}
                    />
                    <span class="body-text">Yes</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- End of drawer preset layout change -->
      </div>

      <!-- Builder canvas placeholder -->
      <div class="margin-y-l radius-l border-default relative flex-1 overflow-hidden bg-secondary-contrast">
        <div class="absolute inset-0 grid place-items-center">
          <div class="text-center">
            <h3 class="heading-3">3D builder canvas</h3>
            <p class="body-text margin-y-s">Placeholder for the virtual drawer + snapping modules.</p>

            <!-- Temporary demo action -->
            <button
              class="radius-m focus-ring bg-primary px-4 py-2 text-primary-contrast transition duration-200 ease-out hover:opacity-90"
              type="button"
              on:click={simulateAddModule}
            >
              Simulate adding a module
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- BOM toggle + drawer (fixed, no page side-scroll).
       The toggle button "sticks" to the top-left of the drawer when open:
       we position it to the left of the drawer width. When closed, it's at top-right of the builder viewport area. -->
  <div
    class="fixed top-6 z-50"
    style={isBomOpen ? `right: calc(min(40vw, 420px) + 1.5rem);` : 'right: 1.5rem;'}
  >
    <button
      class="radius-m border-default focus-ring bg-white px-3 py-2"
      type="button"
      on:click={toggleBom}
      aria-expanded={isBomOpen}
      aria-controls="bom-drawer"
      aria-label={isBomOpen ? 'Close BOM' : 'Open BOM'}
    >
      <div class="relative flex items-center gap-2">
        <span class="body-text">{isBomOpen ? '→' : '←'}</span>
        <span class="body-text">BOM</span>

        {#key bumpKey}
          <span
            class="radius-l absolute -right-3 -top-3 grid h-6 min-w-[24px] place-items-center bg-primary px-2 text-xs text-primary-contrast"
            class:shake={moduleCount > 0}
          >
            {moduleCount}
          </span>
        {/key}
      </div>
    </button>
  </div>

  {#if isBomOpen}
    <!-- Click-away overlay (kept non-intrusive: fully transparent). -->
    <button
      class="fixed inset-0 z-40 cursor-default bg-black/0"
      type="button"
      aria-label="Close BOM"
      on:click={toggleBom}
    ></button>

    <!-- Drawer panel -->
    <aside
      id="bom-drawer"
      class="radius-l border-default fixed top-6 right-6 z-50 h-[calc(100vh-3rem)] bg-white shadow-xl"
      style="width: min(40vw, 420px);"
      aria-label="Bill of materials"
    >
      <div class="h-full padding-m">
        <div class="flex items-center justify-between">
          <h3 class="heading-3">Your build</h3>
          <button class="body-text ui-hover" type="button" on:click={toggleBom}>Close</button>
        </div>

        <p class="body-text margin-y-s">This panel will list module counts (BOM) and act as a cart summary.</p>

        <div class="margin-y-m radius-m border-subtle bg-secondary-contrast padding-m">
          <div class="body-text">
            Modules in drawer: <span class="text-primary">{moduleCount}</span>
          </div>
        </div>

        <div class="margin-y-m">
          <button
            class="radius-m focus-ring w-full bg-primary px-4 py-3 text-primary-contrast transition duration-200 ease-out hover:opacity-90"
            type="button"
          >
            Add all to cart (placeholder)
          </button>
        </div>

        <div class="margin-y-m">
          <p class="body-text">
            Later: auto-generated list like “2× 4-jar module (180 mm)” + “1× 3-jar module (135 mm)”.
          </p>
        </div>
      </div>
    </aside>
  {/if}
</div>

<style>
  /* A tiny shake animation for the badge when the count changes.
     We key the badge with bumpKey so the animation restarts on every add. */
  .shake {
    animation: shake 220ms ease-out;
  }

  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    30% {
      transform: translateX(-2px);
    }
    60% {
      transform: translateX(2px);
    }
    100% {
      transform: translateX(0);
    }
  }
</style>

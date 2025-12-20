<script lang="ts">
  import { onMount } from 'svelte';

  import Navbar from '$lib/components/Navbar.svelte';
  import Hero from '$lib/components/Hero.svelte';
  import InfoSection from '$lib/components/InfoSection.svelte';
  import DrawerPreset from '$lib/components/DrawerPreset.svelte';
  import DrawerBuilder from '$lib/components/builder/DrawerBuilder.svelte';

  type DrawerPresetValue = 'custom' | 'ikea-metod-maximera';

  let preset: DrawerPresetValue = 'custom';

  // Dimensions in millimeters
  let widthMm = 600;
  let depthMm = 450;
  let heightMm = 100;

  // Internal side corner profile
  let hasCornerProfile: 'yes' | 'no' = 'no';

  // BOM / Cart-like drawer state
  let isBomOpen = false;
  let moduleCount = 0;
  let bumpKey = 0;

  // Wide screen heuristic
  let isWideViewport = false;
  const WIDE_VIEWPORT_PX = 1100;

  function updateViewportFlags() {
    isWideViewport = window.innerWidth >= WIDE_VIEWPORT_PX;
  }

  function scrollToBuilder() {
    const el = document.getElementById('builder');
    if (!el) return;

    history.replaceState(null, '', '#builder');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

    if (window.location.hash === '#builder') {
      requestAnimationFrame(() => {
        document.getElementById('builder')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    }

    return () => window.removeEventListener('resize', updateViewportFlags);
  });
</script>

<div class="overflow-x-hidden">
  <Navbar />
  <Hero {scrollToBuilder} />
  <InfoSection />

  <!-- BUILDER SECTION: 100vh total -->
  <section id="builder" class="h-screen bg-white">
    <div class="mx-auto h-full max-w-6xl padding-l flex flex-col gap-4">
      <!-- Presets: fixed 20vh -->
      <div class="h-[20vh] min-h-[100px]">
        <DrawerPreset
          bind:preset
          bind:widthMm
          bind:depthMm
          bind:heightMm
          bind:hasCornerProfile
        />
      </div>

      <!-- Builder: takes the remaining height -->
      <div class="flex-1 min-h-0">
        <DrawerBuilder
          bind:widthMm
          bind:depthMm
          bind:heightMm
          bind:hasCornerProfile
          onAddModule={simulateAddModule}
        />
      </div>
    </div>
  </section>

  <!-- BOM toggle -->
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
    <!-- Click-away overlay -->
    <button
      class="fixed inset-0 z-40 bg-black/0"
      type="button"
      aria-label="Close BOM"
      on:click={toggleBom}
    ></button>

    <!-- BOM drawer -->
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
      </div>
    </aside>
  {/if}
</div>

<style>
  .shake {
    animation: shake 220ms ease-out;
  }

  @keyframes shake {
    0% { transform: translateX(0); }
    30% { transform: translateX(-2px); }
    60% { transform: translateX(2px); }
    100% { transform: translateX(0); }
  }
</style>

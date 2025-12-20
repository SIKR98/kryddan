<script lang="ts">
  import { onMount } from 'svelte';

  import Navbar from '$lib/components/Navbar.svelte';
  import Hero from '$lib/components/Hero.svelte';
  import InfoSection from '$lib/components/InfoSection.svelte';
  import DrawerPreset from '$lib/components/DrawerPreset.svelte';
  import DrawerBuilder from '$lib/components/builder/DrawerBuilder.svelte';
  import BomDrawer from '$lib/components/BomDrawer.svelte';

  type DrawerPresetValue = 'custom' | 'ikea-metod-maximera';
  type SectionId = 'home' | 'features' | 'builder' | 'about';

  const navItems: Array<{ label: string; id?: SectionId; kind: 'scroll' | 'route' }> = [
    { label: 'Home', id: 'home', kind: 'scroll' },
    { label: 'Features', id: 'features', kind: 'scroll' },
    { label: 'Builder', id: 'builder', kind: 'scroll' },
    { label: 'About', id: 'about', kind: 'scroll' },
    { label: 'Cart', kind: 'route' } // later: route navigation
  ];

  // Drawer configuration state
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

  // Sticky navbar until builder
  let isNavbarSticky = true;
  let builderTop = 0;

  // Scroll persistence keys
  const SCROLL_Y_KEY = 'kryddan:scrollY';
  const LAST_SECTION_KEY = 'kryddan:lastSectionId';

  function updateViewportFlags() {
    isWideViewport = window.innerWidth >= WIDE_VIEWPORT_PX;
  }

  function measureBuilderTop() {
    const builderEl = document.getElementById('builder');
    if (!builderEl) return;
    builderTop = builderEl.offsetTop;
  }

  function updateStickyState(scrollY: number) {
    // Sticky only until the builder section starts
    isNavbarSticky = scrollY < builderTop;
  }

  function scrollToSection(id: SectionId) {
    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sessionStorage.setItem(LAST_SECTION_KEY, id);
  }

  // Backwards compatible for Hero (keeps your existing Hero API)
  function scrollToBuilder() {
    scrollToSection('builder');
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

  function closeBom() {
    isBomOpen = false;
  }

  onMount(() => {
    updateViewportFlags();
    measureBuilderTop();
    updateStickyState(window.scrollY);

    const onResize = () => {
      updateViewportFlags();
      measureBuilderTop();
      updateStickyState(window.scrollY);
    };

    // Persist scroll position (throttled with rAF)
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;

        sessionStorage.setItem(SCROLL_Y_KEY, String(y));
        updateStickyState(y);

        ticking = false;
      });
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Restore scroll position on refresh (no URL hashes)
    const savedY = sessionStorage.getItem(SCROLL_Y_KEY);
    if (savedY) {
      const y = Number(savedY);
      if (!Number.isNaN(y)) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: 'auto' });
          measureBuilderTop();
          updateStickyState(window.scrollY);
        });
      }
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  });
</script>

<div class="overflow-x-hidden">
  <!-- Sticky behavior controlled here (not inside Navbar) -->
  <div class:sticky-nav={isNavbarSticky}>
    <!-- Site container: controls width + horizontal padding globally -->
    <div class="mx-auto max-w-6xl padding-l">
      <Navbar {navItems} onNavigate={scrollToSection} />
    </div>
  </div>

  <!-- HOME -->
  <section id="home">
    <!-- Site container -->
    <div class="mx-auto max-w-6xl padding-l">
      <Hero {scrollToBuilder} />
    </div>
  </section>

  <!-- FEATURES (InfoSection is already a <section id="features">) -->
  <!-- Site container -->
  <div class="mx-auto max-w-6xl padding-l">
    <InfoSection />
  </div>

  <!-- BUILDER SECTION: 100vh total -->
  <section id="builder" class="h-screen bg-white">
    <!-- Site container -->
    <div class="mx-auto h-full max-w-6xl padding-l flex flex-col gap-4">
      <!-- Presets: fixed 20vh -->
      <div class="h-[20vh] min-h-[100px]">
        <DrawerPreset bind:preset bind:widthMm bind:depthMm bind:heightMm bind:hasCornerProfile />
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

  <!-- ABOUT -->
  <section id="about" class="min-h-screen bg-secondary-contrast">
    <!-- Site container -->
    <div class="mx-auto max-w-6xl padding-l">
      <h2 class="heading-2">About</h2>
      <p class="body-text margin-y-s">
        This section is a placeholder for now. We’ll replace it with real content later.
      </p>
    </div>
  </section>

  <!-- BOM Drawer -->
  <BomDrawer
    isOpen={isBomOpen}
    {moduleCount}
    {bumpKey}
    title="Your build"
    onToggle={toggleBom}
    onClose={closeBom}
  />
</div>

<style>
  .sticky-nav {
    position: sticky;
    top: 0;
    z-index: 60;
  }
</style>

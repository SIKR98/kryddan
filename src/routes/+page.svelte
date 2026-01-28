<script lang="ts">
  import { onMount, tick } from 'svelte';

  import Navbar from '$lib/components/Navbar.svelte';
  import Hero from '$lib/components/Hero.svelte';
  import InfoSection from '$lib/components/InfoSection.svelte';
  import DrawerPreset from '$lib/components/DrawerPreset.svelte';
  import DrawerBuilder from '$lib/components/builder/DrawerBuilder.svelte';
  import AboutSection from '$lib/components/AboutSection.svelte';
  import Footer from '$lib/components/Footer.svelte';

  type DrawerPresetValue = 'custom' | 'ikea-metod-maximera';
  type SectionId = 'home' | 'features' | 'builder' | 'about';

  const navItems: Array<{ label: string; id?: SectionId; kind: 'scroll' | 'route' }> = [
    { label: 'Home', id: 'home', kind: 'scroll' },
    { label: 'Features', id: 'features', kind: 'scroll' },
    { label: 'Builder', id: 'builder', kind: 'scroll' },
    { label: 'About', id: 'about', kind: 'scroll' },
    { label: 'Cart', kind: 'route' }
  ];

  // Drawer configuration state
  let preset: DrawerPresetValue = 'custom';

  let widthMm = 407;
  let depthMm = 611;
  let heightMm = 56;
  let hasCornerProfile: 'yes' | 'no' = 'no';

  // BOM / Cart-like drawer state
  let isBomOpen = false;
  let moduleCount = 0;
  let bumpKey = 0;

  // Viewport
  let isWideViewport = false;
  const WIDE_VIEWPORT_PX = 1100;

  // Scroll persistence
  const SCROLL_Y_KEY = 'kryddan:scrollY';

  // ⬇️ tweakbar delay before restore
  const RESTORE_SCROLL_DELAY_MS = 200;

  // Scroll lock (keeps scrollbar visible)
  let isScrollLocked = false;

  function lockScrollInput() {
    isScrollLocked = true;
  }

  function unlockScrollInput() {
    isScrollLocked = false;
  }

  function updateViewportFlags() {
    isWideViewport = window.innerWidth >= WIDE_VIEWPORT_PX;
  }

  function scrollToSection(id: SectionId) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToBuilder() {
    scrollToSection('builder');
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

  function closeBom() {
    isBomOpen = false;
  }

  // --- Sticky-until-builder logic ---
  let navEl: HTMLDivElement | null = null;
  let navHeight = 0;
  let builderTop = 0;

  type NavMode = 'fixed' | 'absolute';
  let navMode: NavMode = 'fixed';
  let navAbsTop = 0;

  function measureBuilderTop() {
    const builderEl = document.getElementById('builder');
    if (!builderEl) return;
    builderTop = builderEl.offsetTop;
  }

  function measureNavHeight() {
    if (!navEl) return;
    navHeight = navEl.offsetHeight || 0;
  }

  function updateNavMode(scrollY: number) {
    const stopY = Math.max(0, builderTop - navHeight);
    navMode = scrollY >= stopY ? 'absolute' : 'fixed';
    navAbsTop = stopY;
  }
  // ----------------------------------

  onMount(() => {
    // prevent browser native restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    updateViewportFlags();
    tick();

    measureNavHeight();
    measureBuilderTop();
    updateNavMode(0);

    const onScroll = () => {
      if (isScrollLocked) return;
      sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY));
      updateNavMode(window.scrollY);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    const savedY = sessionStorage.getItem(SCROLL_Y_KEY);

    if (savedY) {
      const targetY = Number(savedY);

      if (!Number.isNaN(targetY) && targetY > 0) {
        // always start at top visually
        window.scrollTo({ top: 0, behavior: 'auto' });
        lockScrollInput();

        setTimeout(() => {
          window.scrollTo({ top: targetY, behavior: 'smooth' });

          // unlock after scroll finishes
          setTimeout(() => {
            unlockScrollInput();
            measureBuilderTop();
            measureNavHeight();
            updateNavMode(window.scrollY);
          }, 600);
        }, RESTORE_SCROLL_DELAY_MS);
      }
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  });
</script>

<!-- Transparent scroll-lock overlay (keeps scrollbar, blocks input) -->
{#if isScrollLocked}
  <div class="fixed inset-0 z-[9999]" aria-hidden="true"></div>
{/if}

<!-- BODY -->
<div class="grid w-full grid-rows-[repeat(4,100vh)] px-s md:px-xl relative bg-primary">
  <!-- NAVBAR -->
  <div
    bind:this={navEl}
    class="z-[60] w-full"
    style={navMode === 'fixed'
      ? 'position: fixed; top: 0; left: 0; right: 0;'
      : `position: absolute; top: ${navAbsTop}px; left: 0; right: 0;`}
  >
    <div class="bg-primary-accent/80 backdrop-blur border-b border-primary/10">
      <Navbar {navItems} onNavigate={scrollToSection} />
    </div>
  </div>

  <!-- ROW 1: Home -->
  <section id="home" class="h-[100vh] w-full grid">
    <div class="grid h-full w-full justify-items-center items-start md:items-center">
      <Hero {scrollToBuilder} />
    </div>
  </section>

  <!-- ROW 2: Features -->
  <section class="h-[100vh] w-full grid place-items-center">
    <InfoSection />
  </section>

  <!-- ROW 3: Builder -->
  <section id="builder" class="h-[100vh] w-full grid place-items-center py-m">
    <div class="flex h-full w-full flex-col">
      <div class="flex-none grid justify-items-center items-start text-center">
        <DrawerPreset
          bind:preset
          bind:widthMm
          bind:depthMm
          bind:heightMm
          bind:hasCornerProfile
        />
      </div>

      <div class="flex-1 min-h-0 grid place-items-center overflow-hidden pt-s">
        <DrawerBuilder
          bind:widthMm
          bind:depthMm
          bind:heightMm
          bind:hasCornerProfile
          onAddModule={simulateAddModule}
          isBomOpen={isBomOpen}
          moduleCount={moduleCount}
          bumpKey={bumpKey}
          onToggleBom={toggleBom}
          onCloseBom={closeBom}
        />
      </div>
    </div>
  </section>

  <!-- ROW 4: About -->
  <section id="about" class="h-[100vh] w-full grid place-items-center">
    <AboutSection />
  </section>

  <!-- Footer -->
  <section class="w-full">
    <div class="-mx-s md:-mx-xl">
      <Footer />
    </div>
  </section>
</div>

<style></style>

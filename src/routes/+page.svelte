<script lang="ts">
  import { onMount, tick } from 'svelte';

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

  // Scroll persistence keys
  const SCROLL_Y_KEY = 'kryddan:scrollY';
  const LAST_SECTION_KEY = 'kryddan:lastSectionId';

  function updateViewportFlags() {
    isWideViewport = window.innerWidth >= WIDE_VIEWPORT_PX;
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

  // --- Sticky-until-builder logic (minimal, keeps everything else the same) ---
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
    // Stop pinning exactly before builder starts.
    const stopY = Math.max(0, builderTop - navHeight);

    if (scrollY >= stopY) {
      navMode = 'absolute';
      navAbsTop = stopY;
    } else {
      navMode = 'fixed';
      navAbsTop = stopY; // keep last sane value
    }
  }
  // -------------------------------------------------------------------------

  onMount(() => {
    const initializeAsync = async () => {
      updateViewportFlags();

      await tick();
      measureNavHeight();
      measureBuilderTop();
      updateNavMode(window.scrollY);

      const onResize = async () => {
        updateViewportFlags();
        await tick();
        measureNavHeight();
        measureBuilderTop();
        updateNavMode(window.scrollY);
      };

      // Persist scroll position (throttled with rAF)
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
          const y = window.scrollY;

          sessionStorage.setItem(SCROLL_Y_KEY, String(y));
          updateNavMode(y);

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
            measureNavHeight();
            updateNavMode(window.scrollY);
          });
        }
      }

      return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
      };
    };

    initializeAsync();

    return () => {
      // cleanup if needed
    };
  });
</script>

<!-- "Body" wrapper: 4 rows x 100vh -->
<div class="grid w-full grid-rows-[repeat(4,100vh)] px-xl relative">
  <!-- NAVBAR overlay: stays through section 1 + 2, then releases before section 3 -->
  <div
    bind:this={navEl}
    class="z-[60] w-full"
    style={navMode === 'fixed'
      ? 'position: fixed; top: 0; left: 0; right: 0;'
      : `position: absolute; top: ${navAbsTop}px; left: 0; right: 0;`}
  >
    <!-- keep same horizontal alignment as grid padding -->
    <div class="px-xl">
      <Navbar {navItems} onNavigate={scrollToSection} />
    </div>
  </div>

  <!-- ROW 1: Home (Hero) -->
  <section id="home" class="h-[100vh] w-full grid place-items-center">
    <div class="grid h-full w-full">
      <div class="grid place-items-center">
        <div class="">
          <Hero {scrollToBuilder} />
        </div>
      </div>
    </div>
  </section>

  <!-- ROW 2: Features -->
  <section class="h-[100vh] w-full grid place-items-center">
    <InfoSection />
  </section>

  <!-- ROW 3: Builder -->
  <section id="builder" class="h-[100vh] w-full grid place-items-center bg-white">
    <div class="grid h-full w-full grid-rows-[18vh_1fr]">
      <div class="grid justify-items-center items-start text-center">
        <DrawerPreset bind:preset bind:widthMm bind:depthMm bind:heightMm bind:hasCornerProfile />
      </div>

      <div class="grid place-items-center">
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

  <!-- ROW 4: About -->
  <section id="about" class="h-[100vh] w-full grid place-items-center bg-secondary-contrast">
    <div class="grid place-items-center">
      <div class="text-center">
        <h2 class="heading-2">About</h2>
        <p class="body-text">
          This section is a placeholder for now. We’ll replace it with real content later.
        </p>
      </div>

      <footer class="text-center">
        <p class="body-text">© Kryddan</p>
      </footer>
    </div>
  </section>
</div>

<!-- BOM Drawer (unchanged) -->
<BomDrawer
  isOpen={isBomOpen}
  {moduleCount}
  {bumpKey}
  title="Your build"
  onToggle={toggleBom}
  onClose={closeBom}
/>

<style>
  /* sticky-nav class kept (not used for positioning anymore, but leaving it avoids breaking other assumptions) */
  .sticky-nav {
    position: sticky;
    top: 0;
    z-index: 60;
  }
</style>

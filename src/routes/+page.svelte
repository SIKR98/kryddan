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

  onMount(() => {
    updateViewportFlags();

    const onResize = () => {
      updateViewportFlags();
    };

    // Persist scroll position (throttled with rAF)
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;

        sessionStorage.setItem(SCROLL_Y_KEY, String(y));

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
        });
      }
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  });
</script>

<!-- "Body" wrapper: 4 rows x 100vh, full width, no padding/margins/gaps -->
<div class="grid w-full grid-rows-4 px-xl">
  <!-- PRE-BUILDER WRAPPER: sticky-nav is constrained to sections 1+2 and stops before section 3 -->
  <div class="grid">
    <div class="sticky-nav">
      <Navbar {navItems} onNavigate={scrollToSection} />
    </div>

    <!-- SECTION 1: Hero (nav is above, still within the same prebuilder wrapper) -->
    <section id="home" class="max-h-[100vh] w-full grid place-items-center">
      <div class="grid h-full w-full">
        <div class="grid place-items-center">
          <div class="">
            <Hero {scrollToBuilder} />
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 2: InfoSection -->
    <section class="h-screen w-full grid place-items-center">
      <InfoSection />
    </section>
  </div>

  <!-- SECTION 3: DrawerPreset + DrawerBuilder -->
  <section id="builder" class="h-screen w-full grid place-items-center bg-white">
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

  <!-- SECTION 4: About (+ footer placeholder inside section) -->
  <section id="about" class="h-screen w-full grid place-items-center bg-secondary-contrast">
    <div class="grid place-items-center">
      <div class="text-center">
        <h2 class="heading-2">About</h2>
        <p class="body-text">
          This section is a placeholder for now. We’ll replace it with real content later.
        </p>
      </div>

      <!-- Minimal footer placeholder (no padding/margins) -->
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
  .sticky-nav {
    position: sticky;
    top: 0;
    z-index: 60;
  }
</style>

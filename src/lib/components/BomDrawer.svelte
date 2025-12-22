<script lang="ts">
  import { onMount } from 'svelte';

  export let isOpen = false;
  export let moduleCount = 0;
  export let onClose: () => void = () => {};
  export let title = 'Your build';

  onMount(() => {
    const onScroll = () => {
      if (isOpen) onClose();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<!-- Overlay -->
<button
  class="overlay"
  class:is-open={isOpen}
  aria-label="Close BOM"
  on:click={onClose}
/>

<!-- Drawer -->
<aside
  id="bom-drawer"
  class="drawer"
  class:is-open={isOpen}
  aria-label="Bill of materials"
>
  <div class="h-full padding-m flex flex-col">
    <div class="flex items-center justify-between">
      <h3 class="heading-3">{title}</h3>
      <button class="body-text ui-hover" on:click={onClose}>Close</button>
    </div>

    <p class="body-text margin-y-s">
      This panel will list module counts (BOM) and act as a cart summary.
    </p>

    <div class="margin-y-m radius-m border-subtle bg-secondary-contrast padding-m">
      Modules in drawer: <span class="text-primary">{moduleCount}</span>
    </div>

    <div class="mt-auto">
      <button class="radius-m w-full bg-primary px-4 py-3 text-primary-contrast">
        Add all to cart
      </button>
    </div>
  </div>
</aside>

<style>
  /* ===== Overlay ===== */
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0,0,0,0);
    pointer-events: none;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .overlay.is-open {
    opacity: 1;
    pointer-events: auto;
  }

  /* ===== Drawer ===== */
  .drawer {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 50;
    height: calc(100vh - 3rem);
    width: min(40vw, 420px);
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,.15);

    transform: translateX(24px);
    opacity: 0;
    pointer-events: none;

    transition:
      transform 220ms ease,
      opacity 220ms ease;
  }

  .drawer.is-open {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
  }
</style>

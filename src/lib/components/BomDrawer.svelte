<script lang="ts">
  export let isOpen = false;
  export let moduleCount = 0;

  // Change this value to restart the badge animation (keyed block)
  export let bumpKey = 0;

  export let onToggle: () => void = () => {};
  export let onClose: () => void = () => {};

  // Optional: You can pass additional content later (BOM rows, cart summary, etc.)
  export let title = 'Your build';
</script>

<!-- Toggle button -->
<div
  class="fixed top-6 z-50"
  style={isOpen ? `right: calc(min(40vw, 420px) + 1.5rem);` : 'right: 1.5rem;'}
>
  <button
    class="radius-m border-default focus-ring bg-white px-3 py-2"
    type="button"
    on:click={onToggle}
    aria-expanded={isOpen}
    aria-controls="bom-drawer"
    aria-label={isOpen ? 'Close BOM' : 'Open BOM'}
  >
    <div class="relative flex items-center gap-2">
      <span class="body-text">{isOpen ? '→' : '←'}</span>
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

{#if isOpen}
  <!-- Click-away overlay -->
  <button
    class="fixed inset-0 z-40 bg-black/0"
    type="button"
    aria-label="Close BOM"
    on:click={onClose}
  ></button>

  <!-- Drawer panel -->
  <aside
    id="bom-drawer"
    class="radius-l border-default fixed top-6 right-6 z-50 h-[calc(100vh-3rem)] bg-white shadow-xl"
    style="width: min(40vw, 420px);"
    aria-label="Bill of materials"
  >
    <div class="h-full padding-m flex flex-col">
      <div class="flex items-center justify-between">
        <h3 class="heading-3">{title}</h3>
        <button class="body-text ui-hover" type="button" on:click={onClose}>Close</button>
      </div>

      <p class="body-text margin-y-s">
        This panel will list module counts (BOM) and act as a cart summary.
      </p>

      <div class="margin-y-m radius-m border-subtle bg-secondary-contrast padding-m">
        <div class="body-text">
          Modules in drawer: <span class="text-primary">{moduleCount}</span>
        </div>
      </div>

      <div class="mt-auto">
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

<style>
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

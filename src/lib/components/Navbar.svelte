<script context="module" lang="ts">
  export type SectionId = 'home' | 'features' | 'builder' | 'about';

  export type NavItem = {
    label: string;
    kind: 'scroll' | 'route';
    id?: SectionId;
  };
</script>

<script lang="ts">
  export let navItems: NavItem[] = [
    { label: 'Home', kind: 'scroll', id: 'home' },
    { label: 'Features', kind: 'scroll', id: 'features' },
    { label: 'Builder', kind: 'scroll', id: 'builder' },
    { label: 'About', kind: 'scroll', id: 'about' },
    { label: 'Cart', kind: 'route' }
  ];

  // Called by parent (+page.svelte) to do the actual scroll
  export let onNavigate: (id: SectionId) => void = () => {};

  function handleClick(item: NavItem) {
    if (item.kind === 'scroll' && item.id) {
      onNavigate(item.id);
      return;
    }

    // Route placeholder for Cart (will become a real route later)
    if (item.kind === 'route') {
      // Intentionally no-op for now
      return;
    }
  }
</script>

<header class="bg-white/80 backdrop-blur border-b border-primary/10">
  <div class="flex items-center justify-between h-[10vh]">
    <button type="button" class="flex items-center gap-3" on:click={() => onNavigate('home')}>
      <div class="radius-m border-default flex h-10 w-10 items-center justify-center bg-white">
        <span class="heading-3">SK</span>
      </div>
      <span class="heading-3">Spice Drawer</span>
    </button>

    <nav class="hidden items-center gap-6 md:flex" aria-label="Primary">
      {#each navItems as item}
        <button type="button" class="body-text ui-hover" on:click={() => handleClick(item)}>
          {item.label}
        </button>
      {/each}
    </nav>
  </div>
</header>

<script lang="ts">
  /**
   * Static content for the info cards.
   * This lives here on purpose so +page.svelte stays clean.
   */
  const cards = [
    {
      title: 'Angled for visibility',
      description: 'Read labels faster and grab jars comfortably.',
      image: '/images/info-angled.jpg',
      alt: 'Angled spice jar inserts in a drawer'
    },
    {
      title: 'Stops rolling & rattling',
      description: 'Keeps spice jars aligned and quiet inside the drawer.',
      image: '/images/info-quiet.jpg',
      alt: 'Spice jars held firmly in place'
    },
    {
      title: 'Modular sizing',
      description: 'Combine 2-, 3-, and 4-jar modules to fit your layout.',
      image: '/images/info-modular.jpg',
      alt: 'Different module sizes arranged in a drawer'
    },
    {
      title: 'IKEA profile option',
      description: 'Designed to maximize space in drawers with internal profiles.',
      image: '/images/info-ikea.jpg',
      alt: 'Insert fitting an IKEA-style drawer'
    }
  ];
</script>

<section id="info" class="min-h-screen bg-white">
  <div class="mx-auto flex min-h-screen max-w-6xl flex-col justify-center padding-l">
    <!-- Section header -->
    <div class="max-w-3xl">
      <h2 class="heading-2">Designed for a better spice drawer</h2>
      <p class="body-text margin-y-s">
        A modular system that keeps jars visible, stable, and easy to grab —
        while letting you build a layout that fits your drawer exactly.
      </p>
    </div>

    <!-- Cards -->
    <div class="margin-y-l grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {#each cards as card}
        <article
          class="radius-l border-default bg-secondary-contrast overflow-hidden
                 transform-gpu transition duration-200 ease-out
                 hover:scale-[1.03] hover:shadow-lg"
        >
          <div class="aspect-[16/10] overflow-hidden bg-white">
            <img
              src={card.image}
              alt={card.alt}
              loading="lazy"
              class="h-full w-full object-cover"
            />
          </div>

          <div class="padding-m">
            <h3 class="heading-3">{card.title}</h3>
            <p class="body-text margin-y-s">{card.description}</p>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>

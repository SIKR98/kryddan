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

<!-- Features section (outer spacing/layout must be owned by +page.svelte) -->
<section id="features" class="h-screen w-full">
  <div class="grid h-full w-full grid-rows-[30vh_1fr]">
    <!-- Section header: 25vh -->
    <div class="grid justify-items-center items-end text-center">
      <div>
        <h2 class="heading-2">Designed for a better spice drawer</h2>
        <p class="body-text margin-y-s">
          A modular system that keeps jars visible, stable, and easy to grab —
          while letting you build a layout that fits your drawer exactly.
        </p>
      </div>
    </div>

    <!-- Cards: remaining height -->
    <div class="grid h-full w-full grid-cols-2 grid-rows-2 gap-4 md:grid-cols-4 md:grid-rows-1">
      {#each cards as card}
        <div class="grid place-items-center">
          <article
            class="w-full max-h-[60vh] bg-secondary aspect-[1/1.5] border-default overflow-hidden
                   transform-gpu transition duration-200 ease-out
                   hover:scale-[1.03] hover:shadow-lg"
          >
            <div class="overflow-hidden">
              <img
                src={card.image}
                alt={card.alt}
                loading="lazy"
                class="h-full w-full object-cover"
              />
            </div>

            <div class="padding-m text-center">
              <h3 class="heading-3">{card.title}</h3>
              <p class="body-text margin-y-s">{card.description}</p>
            </div>
          </article>
        </div>
      {/each}
    </div>
  </div>
</section>

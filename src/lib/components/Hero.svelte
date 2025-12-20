<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';

	export let scrollToBuilder: () => void;
</script>

<!-- HERO (100vh) -->
<section class="min-h-screen bg-secondary-contrast">
	<div class="mx-auto flex min-h-screen max-w-6xl flex-col justify-between padding-l">

		<!-- Hero content -->
		<div class="grid items-center gap-10 md:grid-cols-2">
			<div>
				<h1 class="heading-1">
					A quiet, angled, modular spice drawer — built to fit your space.
				</h1>

				<p class="body-text margin-y-m">
					Forward-angled inserts keep jars visible and easy to grab. Modules
					prevent rolling and rattling, and let you build a layout that matches
					your exact drawer.
				</p>

				<div class="flex flex-wrap items-center gap-3">
					<button
						type="button"
						class="radius-m focus-ring bg-primary px-5 py-3 text-primary-contrast transition duration-200 ease-out hover:opacity-90"
						on:click={scrollToBuilder}
					>
						Build your drawer
					</button>

					<a
						href="#sizes"
						class="radius-m border-default ui-hover focus-ring bg-white px-5 py-3"
					>
						<span class="body-text">See sizes</span>
					</a>
				</div>

				<!-- Trust strip -->
				<div class="margin-y-l grid grid-cols-2 gap-3 md:grid-cols-4">
					<div class="radius-m border-subtle bg-white padding-s">
						<div class="heading-3">Ø45 mm</div>
						<div class="body-text">Jar diameter</div>
					</div>
					<div class="radius-m border-subtle bg-white padding-s">
						<div class="heading-3">110 mm</div>
						<div class="body-text">Jar length</div>
					</div>
					<div class="radius-m border-subtle bg-white padding-s">
						<div class="heading-3">23 mm</div>
						<div class="body-text">Module height</div>
					</div>
					<div class="radius-m border-subtle bg-white padding-s">
						<div class="heading-3">IKEA-ready</div>
						<div class="body-text">Profile option</div>
					</div>
				</div>
			</div>

			<!-- Image placeholder -->
			<div class="radius-l border-default relative aspect-[4/3] overflow-hidden bg-white">
				<div class="absolute inset-0 grid place-items-center">
					<div class="text-center">
						<div class="heading-2">Product image</div>
						<p class="body-text margin-y-s">
							Replace with a real drawer photo / render.
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Scroll hint -->
		<div class="flex items-center justify-center pb-6">
			<button
				type="button"
				class="body-text ui-hover"
				on:click={scrollToBuilder}
			>
				↓ Jump to builder
			</button>
		</div>
	</div>
</section>

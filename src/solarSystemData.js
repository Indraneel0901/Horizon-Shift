// Educational descriptions for Horizon Shift's Solar System / exoplanet explorer.
// Distances and rendered sizes are intentionally schematic, not to scale.

export const SOLAR_BODIES = [
  {
    id: "sun", name: "The Sun", classification: "G-type main-sequence star", category: "Star",
    textureStyle: "sun", color: "#ffb44a", radius: 1.05, position: [0, 0, 0], orbitRadius: 0,
    tagline: "The star that assembled the Solar System around it.",
    summary: "The Sun formed about 4.6 billion years ago as a cloud of gas and dust collapsed. Nuclear fusion now turns hydrogen into helium in its core, producing the light and heat that power the planets’ environments.",
    history: [
      { era: "~4.6 billion years ago", title: "Solar nebula collapses", text: "Gravity gathers material into a spinning disk. Most of the system’s mass falls toward the center, where the young Sun forms." },
      { era: "Today", title: "Main-sequence star", text: "Hydrogen fusion supplies energy. The solar wind and magnetic activity shape the heliosphere and influence planetary space weather." },
      { era: "~5 billion years from now", title: "A red-giant future", text: "Models predict the Sun will eventually leave the main sequence and expand greatly. The precise final conditions for each planet are not simulated here." }
    ],
    sourceTitle: "NASA — Sun Facts", sourceUrl: "https://science.nasa.gov/sun/facts/"
  },
  {
    id: "mercury", name: "Mercury", classification: "Terrestrial planet", category: "Rocky world",
    textureStyle: "mercury", color: "#b7b7ad", radius: 0.19, position: [2.55, 0, 0], orbitRadius: 2.55,
    tagline: "A small, iron-rich world with an ancient cratered surface.",
    summary: "Mercury is the smallest planet and the closest to the Sun. Its large metallic core, rocky crust and heavily cratered terrain preserve evidence of a violent early Solar System.",
    history: [
      { era: "~4.5 billion years ago", title: "A dense rocky planet forms", text: "Mercury accretes from material in the hot inner Solar System. Its unusually large iron core is a key clue to its formation." },
      { era: "Early Solar System", title: "Impacts carve the surface", text: "Large impacts leave basins and craters. With little atmosphere to erase them, many ancient features remain visible." },
      { era: "Today", title: "A world of extremes", text: "Mercury has a very thin exosphere and extreme day-night temperature changes. Permanently shadowed polar craters can preserve water ice." }
    ],
    sourceTitle: "NASA — Mercury Facts", sourceUrl: "https://science.nasa.gov/mercury/facts/"
  },
  {
    id: "venus", name: "Venus", classification: "Terrestrial planet", category: "Rocky world",
    textureStyle: "venus", color: "#e8bb77", radius: 0.30, position: [3.55, 0, 0], orbitRadius: 3.55,
    tagline: "A rocky planet transformed by an extreme greenhouse atmosphere.",
    summary: "Venus is similar to Earth in size but has a dense carbon-dioxide atmosphere and a very hot surface. How much water ancient Venus may have had, and how its climate diverged from Earth’s, remain active research questions.",
    history: [
      { era: "~4.6 billion years ago", title: "A neighboring rocky world forms", text: "Venus builds from the same young solar nebula as Earth, but its later climate follows a very different path." },
      { era: "Geological past", title: "Volcanism reshapes the surface", text: "Volcanic plains and other landforms show that the planet has been geologically active. Details of its resurfacing history are still studied." },
      { era: "Today", title: "A runaway greenhouse", text: "A thick atmosphere traps heat and creates crushing surface pressure. The present climate is hostile to known surface life." }
    ],
    sourceTitle: "NASA — Venus Facts", sourceUrl: "https://science.nasa.gov/venus/venus-facts/"
  },
  {
    id: "earth", name: "Earth", classification: "Terrestrial planet", category: "Rocky world",
    textureStyle: "earth", color: "#3b9fe8", radius: 0.32, position: [4.72, 0, 0], orbitRadius: 4.72,
    tagline: "A dynamic planet with liquid-water oceans and known life.",
    summary: "Earth formed about 4.5 billion years ago. Its atmosphere, liquid-water oceans, magnetic field, plate tectonics and biosphere have co-evolved; Earth is the only world known to host life so far.",
    history: [
      { era: "~4.5 billion years ago", title: "Earth assembles", text: "Rocky material collides and accretes. Early impacts and internal heating help separate the core, mantle and crust." },
      { era: "Ancient Earth", title: "Oceans and life emerge", text: "The geological and fossil record shows that liquid water and life existed billions of years ago. The exact details of life’s origin remain uncertain." },
      { era: "Today", title: "A changing, inhabited world", text: "Plate tectonics recycle crust, the carbon cycle affects climate, and living systems alter the atmosphere and surface." }
    ],
    sourceTitle: "NASA — Earth overview", sourceUrl: "https://science.nasa.gov/earth/"
  },
  {
    id: "mars", name: "Mars", classification: "Terrestrial planet", category: "Rocky world",
    textureStyle: "mars", color: "#d56c4b", radius: 0.25, position: [5.95, 0, 0], orbitRadius: 5.95,
    tagline: "A cold desert with geological evidence of ancient flowing water.",
    summary: "Mars has volcanoes, canyons, polar ice and a thin atmosphere. Ancient river valleys, lake deposits and minerals formed in water suggest that its early environment was different from today’s cold, dry surface.",
    history: [
      { era: "~4.5 billion years ago", title: "A rocky world takes shape", text: "Mars forms in the inner Solar System and develops volcanoes and a crust. Its early interior generated a global magnetic field." },
      { era: "Ancient Mars", title: "Water alters the terrain", text: "Valleys, deltas and water-altered minerals preserve evidence that liquid water flowed or pooled on the surface in the distant past." },
      { era: "Today", title: "A thin atmosphere remains", text: "Mars no longer has a global magnetic field like Earth’s and has lost much of its early atmosphere. Rovers investigate whether ancient environments could have supported microbial life." }
    ],
    sourceTitle: "NASA — Mars Facts", sourceUrl: "https://science.nasa.gov/mars/facts/"
  },
  {
    id: "jupiter", name: "Jupiter", classification: "Gas giant", category: "Giant planet",
    textureStyle: "jupiter", color: "#d8a36f", radius: 0.74, position: [8.05, 0, 0], orbitRadius: 8.05,
    tagline: "The largest planet, with deep cloud bands and long-lived storms.",
    summary: "Jupiter is a hydrogen-and-helium gas giant and likely the oldest planet in the Solar System. Its gravity has strongly influenced the evolution of smaller bodies and the architecture of the planetary system.",
    history: [
      { era: "Early Solar System", title: "A giant grows rapidly", text: "Jupiter gathers gas and solids from the young disk. Its large mass makes it a major gravitational architect of the system." },
      { era: "Billions of years", title: "Orbits and moons evolve", text: "Gravity shapes nearby small bodies and a large family of moons. The detailed path of Jupiter’s early migration is reconstructed from models, not directly observed." },
      { era: "Today", title: "Atmospheric belts and storms", text: "Cloud bands, powerful jet streams and the Great Red Spot reveal a dynamic atmosphere above a deep interior." }
    ],
    sourceTitle: "NASA — Jupiter Facts", sourceUrl: "https://science.nasa.gov/jupiter/jupiter-facts/"
  },
  {
    id: "saturn", name: "Saturn", classification: "Gas giant", category: "Giant planet",
    textureStyle: "saturn", color: "#e5c68f", radius: 0.63, position: [10.55, 0, 0], orbitRadius: 10.55, rings: true,
    tagline: "A gas giant surrounded by a wide, bright ring system.",
    summary: "Saturn is mostly hydrogen and helium. Its rings are made of countless icy and rocky particles, and its moons include Titan and Enceladus—worlds of major interest for planetary science.",
    history: [
      { era: "~4.5 billion years ago", title: "A giant forms in the outer disk", text: "Saturn grows in the colder outer Solar System, where volatile materials can contribute to forming giant planets." },
      { era: "Long-term evolution", title: "Rings and moons interact", text: "Gravity among Saturn, its moons and ring particles continually sculpts the system. The age and evolution of the rings remain research topics." },
      { era: "Today", title: "A complex miniature system", text: "Titan has lakes of liquid hydrocarbons; Enceladus vents water-rich material from a subsurface ocean. Neither observation establishes life." }
    ],
    sourceTitle: "NASA — Saturn Facts", sourceUrl: "https://science.nasa.gov/saturn/saturn-facts/"
  },
  {
    id: "uranus", name: "Uranus", classification: "Ice giant", category: "Giant planet",
    textureStyle: "uranus", color: "#82d7dc", radius: 0.48, position: [12.9, 0, 0], orbitRadius: 12.9,
    tagline: "A cold ice giant that rotates on a dramatically tilted axis.",
    summary: "Uranus contains hydrogen, helium and heavier volatile compounds in its deep interior. Its extreme axial tilt makes its seasons unlike those of most other planets; a giant impact is one proposed explanation for the tilt.",
    history: [
      { era: "Early Solar System", title: "An ice giant assembles", text: "Uranus accretes in the cold outer regions. Its deep interior contains material described by planetary scientists as ices under extreme pressure." },
      { era: "Possible ancient impact", title: "A tilted world", text: "A large impact is one hypothesis for Uranus’s extreme tilt, but the exact event is not directly known." },
      { era: "Today", title: "A distant, cold atmosphere", text: "Methane contributes to its blue-green appearance. The planet’s atmosphere and interior remain less explored than those of the gas giants." }
    ],
    sourceTitle: "NASA — Uranus Facts", sourceUrl: "https://science.nasa.gov/uranus/uranus-facts/"
  },
  {
    id: "neptune", name: "Neptune", classification: "Ice giant", category: "Giant planet",
    textureStyle: "neptune", color: "#4778df", radius: 0.47, position: [15.0, 0, 0], orbitRadius: 15.0,
    tagline: "A distant ice giant with fast winds and active weather.",
    summary: "Neptune is a cold, blue ice giant. Its position was predicted from irregularities in Uranus’s orbit before it was observed in 1846, a famous meeting of mathematical prediction and astronomy.",
    history: [
      { era: "Early Solar System", title: "The outer system forms", text: "Neptune assembles in the distant, cold region of the protoplanetary disk. Models of outer-planet migration are used to reconstruct its early history." },
      { era: "1846", title: "Predicted, then observed", text: "Astronomers used calculations based on Uranus’s orbital motion to guide the search that led to Neptune’s discovery." },
      { era: "Today", title: "Weather in the deep cold", text: "Despite receiving little sunlight, Neptune has dynamic atmospheric systems and very fast winds." }
    ],
    sourceTitle: "NASA — Neptune Facts", sourceUrl: "https://science.nasa.gov/neptune/neptune-facts/"
  },
  {
    id: "pluto", name: "Pluto", classification: "Dwarf planet in the Kuiper Belt", category: "Dwarf planet",
    textureStyle: "pluto", color: "#c7a78f", radius: 0.16, position: [16.75, 0, 0], orbitRadius: 16.75,
    tagline: "An icy dwarf planet with mountains, plains and a complex moon system.",
    summary: "Pluto is a dwarf planet beyond Neptune. New Horizons revealed a surprisingly varied icy surface, including young-looking terrain, and showed that small outer-system worlds can remain geologically interesting.",
    history: [
      { era: "Early Solar System", title: "A Kuiper Belt world forms", text: "Pluto forms among icy bodies beyond Neptune. It is part of a population of small worlds left from the Solar System’s formation." },
      { era: "1930", title: "Discovered from Earth", text: "Clyde Tombaugh discovers Pluto in astronomical images. It was classified as the ninth planet until the modern dwarf-planet definition." },
      { era: "2015", title: "New Horizons flyby", text: "The spacecraft reveals mountains of water ice, nitrogen-ice plains and other surface features. The data transformed scientists’ view of Pluto." }
    ],
    sourceTitle: "NASA — Pluto and dwarf planets", sourceUrl: "https://science.nasa.gov/dwarf-planets/pluto/"
  }
];

export const EXOPLANETS = [
  {
    id: "51-pegasi-b", name: "51 Pegasi b", classification: "Hot Jupiter", category: "Hot gas giant",
    textureStyle: "hotjupiter", color: "#ce8d62", radius: 0.57, position: [2.8, 0, 0],
    tagline: "The landmark hot Jupiter that changed exoplanet science.",
    summary: "Discovered in 1995 around a Sun-like star, 51 Pegasi b was the first exoplanet found orbiting a Sun-like star. Its close, fast orbit challenged expectations about where giant planets could be found.",
    history: [
      { era: "Planet formation", title: "A giant forms", text: "Its exact formation and migration path remain model questions. Hot Jupiters may form farther from their stars and move inward, but pathways differ by system." },
      { era: "1995", title: "A discovery changes astronomy", text: "Measurements of the host star’s motion reveal a planet on a very close orbit, establishing that planetary systems can differ dramatically from ours." },
      { era: "Today", title: "A class of extreme worlds", text: "51 Pegasi b is a prototype of hot Jupiters: giant planets orbiting very near their stars." }
    ],
    sourceTitle: "NASA Exoplanet Catalog — 51 Pegasi b", sourceUrl: "https://science.nasa.gov/exoplanet-catalog/51-pegasi-b/"
  },
  {
    id: "trappist-1e", name: "TRAPPIST-1 e", classification: "Earth-sized rocky exoplanet candidate", category: "Rocky world", textureStyle: "exoearth", color: "#76b5bd", radius: 0.34, position: [5.2, 0, 0],
    tagline: "One of seven roughly Earth-sized planets around an ultracool star.",
    summary: "TRAPPIST-1 e is part of a compact system of seven Earth-sized worlds orbiting an ultracool red dwarf. It lies in the star’s habitable zone, but its atmosphere and actual surface conditions are not yet established.",
    history: [
      { era: "System formation", title: "A compact planetary family", text: "The planets orbit close to a small, cool star. Their mutual interactions make this system valuable for studying rocky planets." },
      { era: "2017", title: "Seven worlds revealed", text: "Observations identified a remarkable family of transiting planets. Follow-up work continues to test what their atmospheres are made of." },
      { era: "Today", title: "Habitability is an open question", text: "Being in a habitable zone does not prove a planet has liquid water or life. Atmospheric retention and stellar activity matter." }
    ],
    sourceTitle: "NASA Exoplanet Catalog — TRAPPIST-1 e", sourceUrl: "https://science.nasa.gov/exoplanet-catalog/trappist-1-e/"
  },
  {
    id: "wasp-12b", name: "WASP-12 b", classification: "Ultra-hot gas giant", category: "Hot gas giant", textureStyle: "lava", color: "#e88b4a", radius: 0.68, position: [7.6, 0, 0],
    tagline: "A scorched giant orbiting extremely close to its star.",
    summary: "WASP-12 b is a hot gas giant with an exceptionally close orbit. Intense stellar heating and tidal interactions make it an important case study for how giant planets evolve near their host stars.",
    history: [
      { era: "Formation", title: "A giant planet assembles", text: "Like other giant planets, it accretes gas and solids in its natal system; its present close orbit raises questions about migration and tides." },
      { era: "Discovery and follow-up", title: "An extreme orbit is measured", text: "Transit and stellar measurements reveal a strongly heated planet whose atmosphere and shape are affected by its nearby star." },
      { era: "Today", title: "A planet under intense irradiation", text: "The rendered hot glow is artistic. This scene does not calculate the true atmospheric temperature field or mass-loss rate." }
    ],
    sourceTitle: "NASA Exoplanet Catalog — WASP-12 b", sourceUrl: "https://science.nasa.gov/exoplanet-catalog/wasp-12-b/"
  },
  {
    id: "kepler-16b", name: "Kepler-16 b", classification: "Circumbinary planet", category: "Two-star system", textureStyle: "saturn", color: "#c4ab80", radius: 0.48, position: [10.0, 0, 0],
    tagline: "A planet that orbits two stars instead of one.",
    summary: "Kepler-16 b is a Saturn-sized circumbinary planet. Its discovery confirmed that planets can orbit a pair of stars, like the fictional arrangement that inspired the 'two-sunset' idea.",
    history: [
      { era: "System formation", title: "A planet develops in a binary system", text: "The dynamics of a disk around two stars shape the planet’s possible formation and long-term orbit." },
      { era: "2011", title: "Transits reveal a circumbinary world", text: "Kepler observed the planet passing in front of its stars, allowing the system geometry to be measured." },
      { era: "Today", title: "A stable but different orbit", text: "The planet orbits both stars. The position in this atlas is for navigation only, not its measured orbit." }
    ],
    sourceTitle: "NASA Exoplanet Catalog — Kepler-16 b", sourceUrl: "https://science.nasa.gov/exoplanet-catalog/kepler-16-b/"
  },
  {
    id: "toi-700d", name: "TOI-700 d", classification: "Earth-sized exoplanet", category: "Rocky world", textureStyle: "exoearth", color: "#4ba7bd", radius: 0.33, position: [12.7, 0, 0],
    tagline: "A small planet in the habitable zone of a cool star.",
    summary: "TOI-700 d is an Earth-sized exoplanet discovered by NASA’s TESS mission. It receives stellar energy compatible with several possible climate scenarios, but this alone does not establish habitability or life.",
    history: [
      { era: "System formation", title: "A planet forms around a cool star", text: "The world develops in another planetary system. Its actual geological timeline is not directly observed and must be inferred." },
      { era: "2020", title: "TESS discovery", text: "NASA’s Transiting Exoplanet Survey Satellite identified the planet using the small dip in starlight during a transit." },
      { era: "Today", title: "Atmosphere and climate remain open", text: "The planet’s appearance here is a procedural illustration. It is not a mapped surface and cannot show confirmed oceans or continents." }
    ],
    sourceTitle: "NASA Exoplanet Catalog — TOI-700 d", sourceUrl: "https://science.nasa.gov/exoplanet-catalog/toi-700-d/"
  }
];

export const COSMIC_TIME_MARKS = [
  { value: -4.6, label: "System formation", detail: "~4.6 billion years ago" },
  { value: -3.8, label: "Early bombardment", detail: "Early-system era" },
  { value: 0, label: "Present", detail: "Today" },
  { value: 5, label: "Red-giant era", detail: "~5 billion years in the future" }
];

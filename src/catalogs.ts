import type { Catalog } from './types';

// Catalog chunks are deliberately ordinary source data: replace these starter chunks
// with the generated, versioned Wikidata chunks as the catalog curation pipeline grows.
const movies = ['The Godfather','Citizen Kane','The Shawshank Redemption','2001: A Space Odyssey','The Dark Knight','Pulp Fiction','The Lord of the Rings: The Return of the King','Parasite','Casablanca','Spirited Away','The Matrix','Star Wars','Jaws','Goodfellas','Schindler’s List','The Wizard of Oz','Alien','Blade Runner','Do the Right Thing','Mad Max: Fury Road','The Silence of the Lambs','Moonlight','Everything Everywhere All at Once','Rear Window','Seven Samurai'];
const television = ['The Sopranos','Breaking Bad','The Wire','Mad Men','The Simpsons','Seinfeld','The Twilight Zone','Twin Peaks','Fleabag','The Office','Game of Thrones','The Leftovers','Succession','Better Call Saul','I Love Lucy','The Americans','Atlanta','The Bear','The X-Files','Avatar: The Last Airbender','Chernobyl','The West Wing','BoJack Horseman','Friends','Buffy the Vampire Slayer'];
const games = ['The Legend of Zelda: Ocarina of Time','Baldur’s Gate 3','Tetris','Super Mario Bros. 3','Elden Ring','Chrono Trigger','Portal 2','The Last of Us','Minecraft','Disco Elysium','Final Fantasy VII','Mass Effect 2','Red Dead Redemption 2','Hades','Dark Souls','Half-Life 2','World of Warcraft','Super Metroid','The Witcher 3','Bloodborne','Resident Evil 4','Celeste','Outer Wilds','Metal Gear Solid 3','Stardew Valley'];
const foods = ['Pizza','Sushi','Tacos','Chocolate','Ramen','Cheeseburger','Pasta','Ice cream','Fried chicken','Curry','Dumplings','Steak','French fries','Pho','Burrito','Lasagna','Biryani','Barbecue','Croissant','Pad thai','Kimchi','Falafel','Apple pie','Ceviche','Gelato'];

const make = (id: string, name: string, description: string, items: string[]): Catalog => ({ id, name, description, items, totalItems: items.length, version: 'starter-2026.08', source: 'Curated starter chunk; intended replacement source: versioned Wikidata snapshot.' });
export const catalogs: Catalog[] = [
  make('movies', 'All Movies', 'A progressive all-time movie catalog.', movies),
  make('television', 'All TV Shows', 'A progressive all-time television catalog.', television),
  make('games', 'All Video Games', 'A progressive all-time video game catalog.', games),
  make('foods', 'All Foods', 'A progressive global food catalog.', foods),
];

// Der Datensatz enthält keine Namen. Für die Demo bekommt jede Kundennummer einen festen,
// geschlechtsneutralen Platzhalter-Vornamen – überall gleich, klar als Platzhalter gemeint.
const FIRST_NAMES = ["Alex", "Robin", "Kim", "Luca", "Sascha", "Toni", "Charlie", "Jona", "Mika", "Noa", "Eike", "Kai", "Sam", "Jule", "Nico", "Andrea"];
const INITIALS = "ABDFGHKLMNPRSTWZ";

const hash = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

export const placeholderFirstName = (id: string) => FIRST_NAMES[hash(id) % FIRST_NAMES.length];
/** "Alex K." – for internal lists, always shown together with the customer number. */
export const placeholderName = (id: string) => `${placeholderFirstName(id)} ${INITIALS[(hash(id) >>> 4) % INITIALS.length]}.`;

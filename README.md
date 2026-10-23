# SCC STRIKE – een MSX2-tribute aan Konami's Nemesis-serie

Een horizontale shoot-'em-up in de stijl van Nemesis 1/2/3, Salamander en Gofer no Yabou
op de MSX2: 256×212 beeld, MSX2-palet (3 bits per kleurkanaal), blokkerige tile-terreinen
en muziek via een nagebootste **Konami SCC**-geluidschip (5 wavetable-kanalen + PSG-drums).

Fan-project, niet verbonden aan Konami. Alle muziek en graphics zijn origineel.

## Starten

Open `index.html` in een moderne browser (Chrome, Edge, Firefox). Er is geen build-stap nodig.
Het geluid start na de eerste toetsaanslag (browserregel).

## Besturing

| Toets | Actie |
|---|---|
| Pijltjes / WASD | Bewegen |
| Z / Spatie | Schieten (ingedrukt houden = autofire) |
| X | Power-up uit de meter kiezen |
| C | Wisselen tussen je wapens (Normal / Double / Laser / Ripple / Fire) |
| P / Esc | Pauze |
| M | Geluid aan/uit |
| ← → op titelscherm | Stage kiezen |

Gamepads werken ook (knop A schieten, B power-up, X/Y wapen wisselen, Start pauze).

## Power-ups (Gradius-meter)

Schiet een rode vijand of een complete formatie neer voor een **rode capsule**; elke capsule
schuift de meter één plek op. Druk op **X** om te kiezen:

| Slot | Niveau 1 | Niveau 2+ |
|---|---|---|
| SPEED | sneller (tot 5 stappen) | |
| MISSILE | grondraket | + raket langs het plafond |
| DOUBLE | schot schuin omhoog | + staartkanon naar achteren |
| LASER | korte laser | lange, dikke laser die door vijanden heen gaat |
| OPTION | meevliegende option (max. 4) | |
| ? | schild (10 treffers) | |

Een **blauwe capsule** vernietigt alle vijanden op het scherm. De gele stipjes onder de meter
tonen je niveau.

## Levels

1. **Volcanic Frontier** – planeetoppervlak met vulkanen (ook op het plafond), grotten,
   hatches, walkers en geschutstorens. Eindbaas: **GRAND CORE** – schiet de drie schilden
   voor de kern weg en raak dan de kern.
2. **Bio Hive** – organisch level met tentakels, bellen die zich splitsen, sporenpods,
   cellenwanden die teruggroeien en stenen hoofden die ringen spuwen. Eindbaas: **GORGON EYE** –
   alleen kwetsbaar als het oog open is; schiet eerst de tentakels kapot voor een bonus.

Na stage 2 begint een nieuwe, moeilijkere loop (snellere kogels en "revenge bullets", zoals bij Konami).

## Cheats

| Toets | Effect |
|---|---|
| **G** (±1 seconde ingedrukt houden) | Oneindig levens aan/uit |
| **H** | Wapens en power-ups behouden na doodgaan aan/uit |
| **J** | Direct alle wapens en upgrades (incl. Ripple en Fire Blaster) |

Actieve cheats lichten geel op rechtsonder in de HUD (G / H).

<details>
<summary><b>Secrets (spoilers!)</b></summary>

- **Konami-code** op het titelscherm (↑ ↑ ↓ ↓ ← → ← → B A): start met 30 schepen.
- **Stage 1 – verborgen 1UP:** schiet tegen het grotplafond kort na het begin van de grot
  (rond de geschutstorens aan het plafond). Een onzichtbaar doel laat een extra leven vallen.
- **Stage 1 – bonusstage:** verderop in de grot zit een smalle put in de bodem (er glinstert
  iets onderin). Duik erin voor een geheime bonusstage met munten, capsules en de
  **Ripple Laser**. Daarna word je een stuk vooruit gewarpt.
- **Stage 2 – verborgen 1UP:** de klomp cellen die aan het plafond hangt na de celwanden
  verbergt een extra leven. Schiet hem open.
- **Stage 2 – Fire Blaster:** vernietig alle vier de stenen hoofden (alleen kwetsbaar met open mond).
- **Gorgon Eye:** vernietig beide tentakels voordat het oog sneuvelt voor 10.000 extra punten.

</details>

## Techniek

- `js/gfx.js` – MSX2-palet, sprites als pixelstrings, 5×7 font
- `js/audio.js` – SCC-emulatie: 32-sample golfvormen → Web Audio `PeriodicWave`, sequencer, PSG-ruis en effecten
- `js/music.js` – de composities (titel, 2 levels, baas, bonus, jingles)
- `js/levels.js` – terrein en vijandposities
- `js/entities.js` – vijanden en eindbazen
- `js/game.js` – spelverloop, wapens, HUD, cheats

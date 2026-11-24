# Open Muscle Map (vendored data)

Body artwork for the aesthetic record map, taken from
[PerspicaciousGuy/Open-Muscle-Map](https://github.com/PerspicaciousGuy/Open-Muscle-Map)
(commit `df85e6c6cfecb14f66fd0b39a8d409a417cc6407`, v1.1 "schematic"), released under the
MIT License — see [`LICENSE`](./LICENSE), which must be kept with these files.

`male.json` and `female.json` are a compacted conversion of the upstream
`*-map-data.json` files:

- one entry per view (`front`, `rear`) with its upstream `viewBox`;
- `silhouette`: the body outline shapes;
- `panels`: one entry per muscle panel, with `d` (path, coordinates rounded to one
  decimal), `t` (group and path transforms joined), `z` (`<muscleId>.<side>`, side being
  the patient's) and `k` (structure kind, only on non-selectable structures such as the
  kneecap or the Achilles tendon);
- the upstream colour gradients are dropped: the map is painted with theme tokens.

The muscle ids are listed in `AestheticBodyMuscle` (`src/lib/types.ts`) and the per-view
lists in `BODY_VIEW_MUSCLES` (`../map-templates.ts`); their names are translated under
`AestheticRecord.zones`.

Upstream caveat: the shapes are a stylised, schematic diagram — not a dissection-grade
atlas — and not every panel has been checked against anatomy references.

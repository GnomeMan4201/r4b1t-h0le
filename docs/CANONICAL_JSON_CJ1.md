# CJ-1: Canonical JSON profile

Status: DRAFT FOR IMPLEMENTATION
Module: `cj1.js` (`R4b1tCJ1.check(value)`, `R4b1tCJ1.serialize(value)`)
Vectors: `tests/fixtures/cj-1/cj-1-vectors.json`

CJ-1 is the existing `trail-manifest.js` `canonicalJson` output, restricted to a value profile that JavaScript and Python serialize byte-identically. `canonicalJson`, and v0.1/v0.2 serialization, are not modified. CJ-1 adds a check in front.

First user: `terrain-index-v1` file bytes.

## Value profile (`check`)

A violation throws an error whose `code` is `CANONICAL_PROFILE_VIOLATION`.

- **Scalars:** `null`, `true`, `false`.
- **Numbers:** safe integers only, |n| ≤ 9007199254740991. Not allowed: fractions, exponents, `-0`, NaN, ±Infinity.
- **Strings:** well-formed Unicode, with no lone surrogates.
- **Arrays:** any CJ-1 values.
- **Objects:** plain objects whose keys match `^[A-Za-z0-9_]+$`. ASCII keys make the JavaScript UTF-16 sort equal the Python code-point sort.

## Serialization (`serialize`)

`serialize` runs `check`, then `canonicalJson`:
- No whitespace.
- Object keys are sorted ascending.
- Scalars are written exactly as `JSON.stringify` writes them:
  - `"` `\` `\b` `\f` `\n` `\r` `\t` are escaped.
  - Other code points below U+0020 become `\u00xx`, lowercase.
  - Everything else is raw UTF-8, including U+007F, U+2028 and U+2029.

## Evidence

**Accept vectors.** The repository `canonicalJson` and Python serialization (`json.dumps(value, ensure_ascii=False, separators=(',', ':'))` with sorted keys) agree byte-for-byte on all 7 accept vectors.

**Reject vectors.** The existing `canonicalJson` accepts all 5 reject vectors: a float, an unsafe integer, a lone surrogate, a non-ASCII key and a hyphenated key. That gap is why `check` exists.

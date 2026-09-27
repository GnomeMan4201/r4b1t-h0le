# R4B1T H0L3 Persisted Corpus State Contract v1

Status: DRAFT FOR IMPLEMENTATION

## Purpose

A corpus promotion changes the set of routes from which future selections are
drawn. Persisted exploration state must never survive that change in a way that
causes old routes or commitments to be represented as if they belonged to the
new corpus.

This contract binds persisted Trail and Blind Descent state to the exact corpus
revision that created it.

## Trail draft persistence

The local Trail draft stores:

- `corpusRevision`;
- `corpusSourceId`;
- seed and creation time;
- routes;
- parent/fork declaration.

On load, Trail obtains the verified active corpus from
`R4b1tCorpusAuthority.loadActive()` before treating restored routes as current
draft state.

### Matching revision

If the persisted revision matches the active revision, the draft may continue.

### Mismatched revision

If a restored draft contains routes or parent state and its persisted revision
differs from the active revision, the draft is reset before export or further
ROLL recording.

Reset means:

- new seed;
- new creation time;
- zero routes;
- no parent;
- no imported artifact;
- replay cursor reset;
- sampler cursor reset;
- selection transaction sequence reset.

The new active revision/source are then persisted.

### Legacy unstamped draft migration

Older `r4b1t_trail_draft_v1` records may contain routes but no corpus
revision.

They may be preserved and stamped only while the active source is explicitly
`legacy-urls-v1`, because that is the only corpus under which those historical
drafts could have been created.

If an unstamped restored draft is first encountered after another source has
become active, it is reset rather than guessed into the new corpus.

A draft created in the current page session before asynchronous revision
loading completes is not treated as historical restored state.

## Imported Trail artifacts

Import and replay remain artifact-local operations and may inspect a Trail from
any valid corpus revision.

Forking is different because it creates new current-session state.

A fork is permitted only when:

```text
imported.manifest.corpus_revision == active corpus revision
```

A cross-corpus fork fails closed with a corpus-revision mismatch.

## Blind Descent

Blind public manifests already contain `corpus_revision`.

After loading the active corpus, Blind Descent may restore a saved manifest
only when its declared corpus revision equals the active revision.

On mismatch:

- public saved manifest is discarded;
- private reveal secrets are discarded;
- depth resets to zero;
- a new genesis is created under the active revision.

Matching saved state remains restorable.

## No automatic corpus fallback

Revision mismatch resets local exploration state. It does not change active
corpus authority and does not fall back to a previous corpus.

## Final invariant

> Persisted routes, forks, and blind commitments may continue only under the
> exact corpus revision that created them.

# Recorded discovery serialization/emission reference

These literal CJ-1 vectors were constructed independently with the existing
Node ledger serializer. Python must reproduce the window and proposal bytes.
The two declarations and genesis are synthetic; no real discovery is asserted.
All producer digest values are explicitly dummy zeros. This is a canonical
serialization/emission vector, not an authenticated producer witness, verified
genesis boundary export or published evidence. Complete verification must reject
these dummy digests against real code. Supplied timestamps assert no web history.
